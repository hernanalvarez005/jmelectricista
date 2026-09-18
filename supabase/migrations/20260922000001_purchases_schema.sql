-- Fase 4: compras. Una compra es una adquisición física (no el pago al
-- proveedor). En 'draft' no toca el stock; al recibirla (receive_purchase,
-- migración posterior) genera movimientos de stock valorizados.

create table public.purchase_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  next_number integer not null default 1
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  purchase_number text not null,
  purchase_date date not null,
  status text not null default 'draft' check (status in ('draft', 'received', 'cancelled')),
  notes text,
  document_path text,
  subtotal numeric(20, 6) not null default 0 check (subtotal >= 0),
  total numeric(20, 6) not null default 0 check (total >= 0),
  -- Solo contexto de creación ("se creó desde el faltante de este trabajo").
  -- NO es una imputación de costo: el costo se imputa a un trabajo cuando el
  -- material se consume, no cuando se compra.
  source_job_id uuid references public.jobs (id) on delete set null,
  -- Idempotencia de la creación (doble click / retry).
  client_request_id uuid,
  received_at timestamptz,
  received_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, purchase_number),
  constraint purchases_received_timestamp check (status <> 'received' or received_at is not null),
  constraint purchases_cancelled_timestamp check (status <> 'cancelled' or cancelled_at is not null)
);

create unique index purchases_client_request_uidx
  on public.purchases (organization_id, client_request_id)
  where client_request_id is not null;
create index purchases_org_date_idx on public.purchases (organization_id, purchase_date desc);
create index purchases_supplier_idx on public.purchases (supplier_id);
create index purchases_status_idx on public.purchases (organization_id, status);
create index purchases_source_job_idx on public.purchases (source_job_id);

create trigger purchases_set_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_cost numeric(18, 6) not null check (unit_cost >= 0),
  subtotal numeric(20, 6) not null default 0,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_items_purchase_idx on public.purchase_items (purchase_id, sort_order);
create index purchase_items_material_idx on public.purchase_items (material_id);
create index purchase_items_org_idx on public.purchase_items (organization_id);

create trigger purchase_items_set_updated_at
  before update on public.purchase_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integridad cross-org (no depender solo de RLS).
-- ---------------------------------------------------------------------------
create or replace function public.check_purchase_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_org uuid;
begin
  select organization_id into ref_org from public.suppliers where id = new.supplier_id;
  if ref_org is null or ref_org <> new.organization_id then
    raise exception 'supplier_id no pertenece a organization_id';
  end if;

  if new.source_job_id is not null then
    select organization_id into ref_org from public.jobs where id = new.source_job_id;
    if ref_org is null or ref_org <> new.organization_id then
      raise exception 'source_job_id no pertenece a organization_id';
    end if;
  end if;

  return new;
end;
$$;

create trigger purchases_check_org_consistency
  before insert or update on public.purchases
  for each row execute function public.check_purchase_org_consistency();

-- Una compra que ya afectó inventario (o fue cancelada) no se edita en
-- silencio: solo notas y documento. Las transiciones de estado válidas son
-- draft -> received y draft -> cancelled; las hacen los RPC.
create or replace function public.guard_purchase_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    -- Solo los RPC (receive_purchase / cancel_purchase) cambian el estado;
    -- un UPDATE directo no puede "recibir" una compra sin generar movimientos.
    if current_setting('app.purchase_transition', true) is distinct from 'on' then
      raise exception 'el estado de una compra solo cambia mediante receive_purchase / cancel_purchase';
    end if;
    if old.status = 'draft' and new.status in ('received', 'cancelled') then
      return new;
    end if;
    raise exception 'transición de estado de compra inválida: % -> %', old.status, new.status;
  end if;

  if old.status <> 'draft' then
    if new.supplier_id is distinct from old.supplier_id
      or new.purchase_date is distinct from old.purchase_date
      or new.purchase_number is distinct from old.purchase_number
      or new.subtotal is distinct from old.subtotal
      or new.total is distinct from old.total
      or new.source_job_id is distinct from old.source_job_id
    then
      raise exception 'la compra ya no está en borrador: no se puede editar';
    end if;
  end if;

  return new;
end;
$$;

create trigger purchases_guard_mutation
  before update on public.purchases
  for each row execute function public.guard_purchase_mutation();

create or replace function public.check_purchase_item_org_and_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase_org uuid;
  purchase_status text;
  material_org uuid;
  target_purchase uuid;
begin
  target_purchase := coalesce(new.purchase_id, old.purchase_id);
  select organization_id, status into purchase_org, purchase_status
  from public.purchases where id = target_purchase;

  if purchase_org is null then
    raise exception 'purchase_id inválido';
  end if;

  if tg_op <> 'DELETE' and purchase_org <> new.organization_id then
    raise exception 'purchase_id no pertenece a organization_id';
  end if;

  if purchase_status <> 'draft' then
    raise exception 'la compra ya no está en borrador: no se pueden modificar sus ítems';
  end if;

  if tg_op <> 'DELETE' then
    select organization_id into material_org from public.materials where id = new.material_id;
    if material_org is null or material_org <> new.organization_id then
      raise exception 'material_id no pertenece a organization_id';
    end if;
    -- Subtotal siempre calculado en el servidor.
    new.subtotal := new.quantity * new.unit_cost;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger purchase_items_check_org_and_status
  before insert or update or delete on public.purchase_items
  for each row execute function public.check_purchase_item_org_and_status();

create or replace function public.recalc_purchase_totals(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(20, 6);
begin
  select coalesce(sum(subtotal), 0) into v_subtotal from public.purchase_items where purchase_id = p_purchase_id;
  update public.purchases set subtotal = v_subtotal, total = v_subtotal where id = p_purchase_id;
end;
$$;

create or replace function public.purchase_items_recalc_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_purchase_totals(coalesce(new.purchase_id, old.purchase_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger purchase_items_recalc_totals
  after insert or update or delete on public.purchase_items
  for each row execute function public.purchase_items_recalc_trigger();

-- ---------------------------------------------------------------------------
-- create_purchase: numeración atómica COM-000001 + idempotencia. No hay
-- policy de INSERT directa sobre purchases.
-- ---------------------------------------------------------------------------
create or replace function public.create_purchase(
  p_supplier_id uuid,
  p_purchase_date date,
  p_client_request_id uuid,
  p_notes text default null,
  p_source_job_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_next integer;
  v_id uuid;
begin
  select organization_id into v_org from public.suppliers where id = p_supplier_id;
  if v_org is null then
    raise exception 'proveedor no encontrado';
  end if;

  if not public.is_org_operator(v_org) then
    raise exception 'not authorized';
  end if;

  if p_client_request_id is null then
    raise exception 'client_request_id es obligatorio';
  end if;

  -- Reenvío del mismo request: devolver la compra ya creada sin consumir número.
  select id into v_id from public.purchases
  where organization_id = v_org and client_request_id = p_client_request_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.purchase_counters (organization_id, next_number)
  values (v_org, 2)
  on conflict (organization_id) do update set next_number = purchase_counters.next_number + 1
  returning next_number - 1 into v_next;

  insert into public.purchases (
    organization_id, supplier_id, purchase_number, purchase_date, notes, source_job_id, client_request_id, created_by
  )
  values (
    v_org, p_supplier_id, 'COM-' || lpad(v_next::text, 6, '0'), p_purchase_date, p_notes,
    p_source_job_id, p_client_request_id, auth.uid()
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    -- Carrera entre dos requests con el mismo client_request_id: gana uno.
    select id into v_id from public.purchases
    where organization_id = v_org and client_request_id = p_client_request_id;
    if v_id is null then
      raise;
    end if;
    return v_id;
end;
$$;

revoke all on function public.create_purchase(uuid, date, uuid, text, uuid) from public;
grant execute on function public.create_purchase(uuid, date, uuid, text, uuid) to authenticated;

-- Cancelar solo aplica a borradores. Cancelar una compra ya recibida implica
-- revertir inventario (operación real): fuera de alcance de esta fase.
create or replace function public.cancel_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_status text;
begin
  select organization_id, status into v_org, v_status
  from public.purchases where id = p_purchase_id for update;

  if v_org is null then
    raise exception 'compra no encontrada';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'not authorized';
  end if;

  if v_status = 'cancelled' then
    return;
  end if;

  if v_status = 'received' then
    raise exception 'una compra recibida no se puede cancelar';
  end if;

  perform set_config('app.purchase_transition', 'on', true);
  update public.purchases set status = 'cancelled', cancelled_at = now() where id = p_purchase_id;
end;
$$;

revoke all on function public.cancel_purchase(uuid) from public;
grant execute on function public.cancel_purchase(uuid) to authenticated;
