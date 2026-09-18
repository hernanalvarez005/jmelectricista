-- Fase 4: stock valorizado por costo promedio ponderado móvil.
--
-- Diseño (única fuente de verdad por concepto):
--   * cantidad física       -> material_stock_balances (suma de movimientos, sin cambios)
--   * valor de inventario   -> material_inventory_valuation.inventory_value
--   * costo promedio        -> inventory_value / quantity (derivado, no guardado)
--   * costo de un consumo   -> stock_movements.unit_cost / total_cost, CONGELADO al
--                              insertarse; nunca se recalcula con precios posteriores.
--
-- Toda la mutación ocurre en el trigger stock_movements_valuation (BEFORE
-- INSERT), bajo lock de la fila del material: ninguna ruta de escritura (RPC o
-- insert directo) puede saltearla, y dos movimientos concurrentes del mismo
-- material se serializan.
--
-- Transición de stock histórico: los movimientos anteriores a esta migración
-- NO reciben costo (nunca se les asigna un precio de proveedor). Un material con
-- stock físico y sin valoración queda "no inicializado" hasta que un admin
-- ejecute initialize_material_valuation con un costo unitario inicial
-- (operación auditable en material_valuation_events). Un material con stock 0
-- se valoriza solo con su primera compra.

alter table public.stock_movements
  add column purchase_id uuid references public.purchases (id) on delete restrict,
  add column purchase_item_id uuid references public.purchase_items (id) on delete restrict,
  add column reversal_of_movement_id uuid references public.stock_movements (id) on delete restrict,
  add column unit_cost numeric(18, 6) check (unit_cost is null or unit_cost >= 0),
  add column total_cost numeric(20, 6) check (total_cost is null or total_cost >= 0);

create index stock_movements_purchase_idx on public.stock_movements (purchase_id);
create index stock_movements_reversal_idx on public.stock_movements (reversal_of_movement_id);
create index stock_movements_job_material_idx on public.stock_movements (job_id, material_id);
create index stock_movements_material_created_idx on public.stock_movements (material_id, created_at desc);

create table public.material_inventory_valuation (
  material_id uuid primary key references public.materials (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Invariante: quantity = stock físico del material mientras exista la fila.
  quantity numeric(18, 3) not null check (quantity >= 0),
  inventory_value numeric(20, 6) not null check (inventory_value >= 0),
  initialized_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index material_inventory_valuation_org_idx on public.material_inventory_valuation (organization_id);

create table public.material_valuation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete restrict,
  event_type text not null check (event_type in ('opening')),
  quantity numeric(18, 3) not null,
  unit_cost numeric(18, 6) not null check (unit_cost >= 0),
  total_value numeric(20, 6) not null check (total_value >= 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index material_valuation_events_material_idx on public.material_valuation_events (material_id, created_at desc);

-- Materiales que ya tienen stock negativo histórico: se reportan, NO se corrigen
-- ni se valorizan retroactivamente.
do $$
declare
  n integer;
begin
  select count(*) into n from (
    select material_id
    from public.stock_movements
    group by material_id
    having sum(case when movement_type in ('in', 'return', 'adjustment_in') then quantity else -quantity end) < 0
  ) t;
  raise notice 'Fase 4: % material(es) con stock físico negativo histórico (no se valorizan retroactivamente).', n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Integridad cross-org de los nuevos vínculos del movimiento.
-- ---------------------------------------------------------------------------
create or replace function public.check_stock_movement_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_org uuid;
  ref_material uuid;
  ref_job uuid;
  ref_type text;
begin
  select organization_id into ref_org from public.materials where id = new.material_id;
  if ref_org is null or ref_org <> new.organization_id then
    raise exception 'material_id no pertenece a organization_id';
  end if;

  if new.job_id is not null then
    select organization_id into ref_org from public.jobs where id = new.job_id;
    if ref_org is null or ref_org <> new.organization_id then
      raise exception 'job_id no pertenece a organization_id';
    end if;
  end if;

  if new.purchase_id is not null then
    select organization_id into ref_org from public.purchases where id = new.purchase_id;
    if ref_org is null or ref_org <> new.organization_id then
      raise exception 'purchase_id no pertenece a organization_id';
    end if;
  end if;

  if new.purchase_item_id is not null then
    select organization_id, material_id into ref_org, ref_material from public.purchase_items where id = new.purchase_item_id;
    if ref_org is null or ref_org <> new.organization_id or ref_material <> new.material_id then
      raise exception 'purchase_item_id no pertenece a organization_id/material_id';
    end if;
  end if;

  if new.reversal_of_movement_id is not null then
    select organization_id, material_id, job_id, movement_type
    into ref_org, ref_material, ref_job, ref_type
    from public.stock_movements where id = new.reversal_of_movement_id;
    if ref_org is null or ref_org <> new.organization_id or ref_material <> new.material_id then
      raise exception 'reversal_of_movement_id no pertenece a organization_id/material_id';
    end if;
    if new.movement_type <> 'return' or ref_type <> 'consumption' or ref_job is distinct from new.job_id then
      raise exception 'reversal_of_movement_id solo puede vincular una devolución con un consumo del mismo trabajo';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Valuación. Códigos de error (prefijo del mensaje) que la app traduce:
--   stock_insuficiente, valoracion_no_inicializada, costo_requerido,
--   compra_solo_por_recepcion, devolucion_excede_consumo, costo_devolucion
-- ---------------------------------------------------------------------------
create or replace function public.apply_stock_valuation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.material_inventory_valuation%rowtype;
  has_v boolean;
  phys numeric;
  avg_cost numeric;
  ref public.stock_movements%rowtype;
  already_returned numeric;
  cost numeric;
  material_name text;
begin
  -- Serializa todos los movimientos del mismo material.
  select name into material_name from public.materials where id = new.material_id for update;

  if new.purchase_id is not null and current_setting('app.receiving_purchase', true) is distinct from 'on' then
    raise exception 'compra_solo_por_recepcion: los movimientos de compra los genera receive_purchase';
  end if;

  select * into v from public.material_inventory_valuation where material_id = new.material_id;
  has_v := found;

  if has_v then
    phys := v.quantity;
  else
    select coalesce(sum(case when movement_type in ('in', 'return', 'adjustment_in') then quantity else -quantity end), 0)
    into phys from public.stock_movements where material_id = new.material_id;
  end if;

  if new.movement_type in ('consumption', 'adjustment_out') then
    if new.quantity > phys then
      raise exception 'stock_insuficiente: % tiene % en stock y se intentó retirar %', material_name, phys, new.quantity;
    end if;

    if has_v then
      avg_cost := v.inventory_value / v.quantity;
      new.unit_cost := round(avg_cost, 6);
      if new.quantity = v.quantity then
        new.total_cost := v.inventory_value;  -- sin residuo de redondeo al vaciar
      else
        new.total_cost := round(new.quantity * avg_cost, 6);
      end if;
      update public.material_inventory_valuation
      set quantity = quantity - new.quantity,
          inventory_value = inventory_value - new.total_cost,
          updated_at = now()
      where material_id = new.material_id;
    else
      new.unit_cost := null;
      new.total_cost := null;
    end if;

  elsif new.movement_type = 'return' then
    cost := null;
    if new.reversal_of_movement_id is not null then
      select * into ref from public.stock_movements where id = new.reversal_of_movement_id;
      select coalesce(sum(quantity), 0) into already_returned
      from public.stock_movements where reversal_of_movement_id = ref.id;
      if new.quantity > ref.quantity - already_returned then
        raise exception 'devolucion_excede_consumo: se intenta devolver % de un consumo con % pendiente de devolver',
          new.quantity, ref.quantity - already_returned;
      end if;
      cost := ref.unit_cost;  -- costo histórico del consumo que se revierte
    end if;

    if has_v then
      if cost is null and v.quantity > 0 then
        cost := v.inventory_value / v.quantity;
      end if;
      if cost is null then
        raise exception 'costo_devolucion: no se puede determinar el costo de la devolución de %', material_name;
      end if;
      new.unit_cost := round(cost, 6);
      new.total_cost := round(new.quantity * cost, 6);
      update public.material_inventory_valuation
      set quantity = quantity + new.quantity,
          inventory_value = inventory_value + new.total_cost,
          updated_at = now()
      where material_id = new.material_id;
    else
      new.unit_cost := null;
      new.total_cost := null;
    end if;

  else  -- 'in' | 'adjustment_in'
    if has_v then
      if new.unit_cost is null then
        raise exception 'costo_requerido: el material % tiene valoración; el ingreso requiere costo unitario', material_name;
      end if;
      new.total_cost := round(new.quantity * new.unit_cost, 6);
      update public.material_inventory_valuation
      set quantity = quantity + new.quantity,
          inventory_value = inventory_value + new.total_cost,
          updated_at = now()
      where material_id = new.material_id;
    elsif new.unit_cost is not null then
      if phys <> 0 then
        raise exception 'valoracion_no_inicializada: % tiene stock sin costo; inicializá la valoración antes de ingresar stock valorizado', material_name;
      end if;
      new.total_cost := round(new.quantity * new.unit_cost, 6);
      insert into public.material_inventory_valuation (material_id, organization_id, quantity, inventory_value)
      values (new.material_id, new.organization_id, new.quantity, new.total_cost);
    else
      -- Ingreso sin costo sobre un material sin valoración: comportamiento previo
      -- a Fase 4 (stock físico sin valor).
      new.total_cost := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger stock_movements_valuation
  before insert on public.stock_movements
  for each row execute function public.apply_stock_valuation();

-- ---------------------------------------------------------------------------
-- Inicializar valoración de un material con stock existente.
-- ---------------------------------------------------------------------------
create or replace function public.initialize_material_valuation(
  p_material_id uuid,
  p_unit_cost numeric,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  phys numeric;
begin
  select organization_id into v_org from public.materials where id = p_material_id for update;
  if v_org is null then
    raise exception 'material no encontrado';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'not authorized';
  end if;

  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'el costo unitario debe ser >= 0';
  end if;

  if exists (select 1 from public.material_inventory_valuation where material_id = p_material_id) then
    raise exception 'la valoración de este material ya está inicializada';
  end if;

  select coalesce(sum(case when movement_type in ('in', 'return', 'adjustment_in') then quantity else -quantity end), 0)
  into phys from public.stock_movements where material_id = p_material_id;

  if phys <= 0 then
    raise exception 'sin_stock: el material no tiene stock; su costo se define con la primera compra';
  end if;

  insert into public.material_inventory_valuation (material_id, organization_id, quantity, inventory_value)
  values (p_material_id, v_org, phys, round(phys * p_unit_cost, 6));

  insert into public.material_valuation_events (organization_id, material_id, event_type, quantity, unit_cost, total_value, notes, created_by)
  values (v_org, p_material_id, 'opening', phys, p_unit_cost, round(phys * p_unit_cost, 6), p_notes, auth.uid());
end;
$$;

revoke all on function public.initialize_material_valuation(uuid, numeric, text) from public;
grant execute on function public.initialize_material_valuation(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Vista de valuación por material.
-- ---------------------------------------------------------------------------
create view public.material_valuation
with (security_invoker = true) as
select
  m.organization_id,
  m.id as material_id,
  coalesce(b.current_stock, 0) as current_stock,
  (val.material_id is not null) as valuation_initialized,
  val.inventory_value,
  case when val.material_id is not null and val.quantity > 0 then val.inventory_value / val.quantity end as average_cost,
  (val.material_id is null and coalesce(b.current_stock, 0) > 0) as needs_initialization
from public.materials m
left join public.material_stock_balances b on b.material_id = m.id
left join public.material_inventory_valuation val on val.material_id = m.id;

-- ---------------------------------------------------------------------------
-- register_job_material_consumption: el consumo ahora puede fallar por stock
-- insuficiente, y las correcciones hacia abajo generan devoluciones vinculadas
-- a los consumos del propio trabajo (más reciente primero) para restaurar el
-- costo histórico de lo que se revierte.
-- ---------------------------------------------------------------------------
create or replace function public.register_job_material_consumption(
  p_job_material_id uuid,
  p_actual_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_material uuid;
  v_job uuid;
  v_previous numeric;
  v_delta numeric;
  v_remaining numeric;
  v_take numeric;
  c record;
begin
  if p_actual_quantity < 0 then
    raise exception 'actual_quantity debe ser >= 0';
  end if;

  select organization_id, material_id, job_id, coalesce(actual_quantity, 0)
  into v_org, v_material, v_job, v_previous
  from public.job_materials
  where id = p_job_material_id
  for update;

  if v_org is null then
    raise exception 'job_material no encontrado';
  end if;

  if not public.is_org_operator(v_org) then
    raise exception 'not authorized';
  end if;

  v_delta := p_actual_quantity - v_previous;

  if v_delta > 0 then
    insert into public.stock_movements (organization_id, material_id, job_id, movement_type, quantity, created_by)
    values (v_org, v_material, v_job, 'consumption', v_delta, auth.uid());
  elsif v_delta < 0 then
    v_remaining := -v_delta;
    for c in
      select m.id, m.quantity - coalesce((select sum(r.quantity) from public.stock_movements r where r.reversal_of_movement_id = m.id), 0) as available
      from public.stock_movements m
      where m.job_id = v_job and m.material_id = v_material and m.movement_type = 'consumption'
      order by m.created_at desc, m.id desc
    loop
      exit when v_remaining <= 0;
      continue when c.available <= 0;
      v_take := least(v_remaining, c.available);
      insert into public.stock_movements (organization_id, material_id, job_id, movement_type, quantity, reversal_of_movement_id, created_by)
      values (v_org, v_material, v_job, 'return', v_take, c.id, auth.uid());
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      -- Devolución sin consumo vinculable (historia previa a Fase 4).
      insert into public.stock_movements (organization_id, material_id, job_id, movement_type, quantity, created_by)
      values (v_org, v_material, v_job, 'return', v_remaining, auth.uid());
    end if;
  end if;

  update public.job_materials set actual_quantity = p_actual_quantity where id = p_job_material_id;
end;
$$;
