-- Fase 2: materiales y stock (derivado de movimientos, nunca editable a mano).

-- ---------------------------------------------------------------------------
-- material_categories
-- ---------------------------------------------------------------------------
create table public.material_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index material_categories_org_idx on public.material_categories (organization_id);

create trigger material_categories_set_updated_at
  before update on public.material_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- material_units (configurable por organización; NO hardcodear en frontend)
-- ---------------------------------------------------------------------------
create table public.material_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  symbol text not null check (length(trim(symbol)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index material_units_org_idx on public.material_units (organization_id);

create trigger material_units_set_updated_at
  before update on public.material_units
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- materials
-- ---------------------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id uuid references public.material_categories (id) on delete set null,
  unit_id uuid not null references public.material_units (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  sku text,
  description text,
  minimum_stock numeric(14, 3) not null default 0 check (minimum_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index materials_org_idx on public.materials (organization_id);
create index materials_category_idx on public.materials (category_id);
create index materials_unit_idx on public.materials (unit_id);

create trigger materials_set_updated_at
  before update on public.materials
  for each row execute function public.set_updated_at();

-- category_id / unit_id deben pertenecer a la misma organización que el material.
create or replace function public.check_material_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cat_org uuid;
  unit_org uuid;
begin
  if new.category_id is not null then
    select organization_id into cat_org from public.material_categories where id = new.category_id;
    if cat_org is null or cat_org <> new.organization_id then
      raise exception 'category_id no pertenece a organization_id';
    end if;
  end if;

  select organization_id into unit_org from public.material_units where id = new.unit_id;
  if unit_org is null or unit_org <> new.organization_id then
    raise exception 'unit_id no pertenece a organization_id';
  end if;

  return new;
end;
$$;

create trigger materials_check_org_consistency
  before insert or update on public.materials
  for each row execute function public.check_material_org_consistency();

-- ---------------------------------------------------------------------------
-- stock_movements (fuente de verdad única del stock; append-only)
-- ---------------------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete restrict,
  job_id uuid references public.jobs (id) on delete set null,
  movement_type text not null check (
    movement_type in ('in', 'consumption', 'return', 'adjustment_in', 'adjustment_out')
  ),
  quantity numeric(14, 3) not null check (quantity > 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_movements_org_idx on public.stock_movements (organization_id);
create index stock_movements_material_idx on public.stock_movements (material_id);
create index stock_movements_job_idx on public.stock_movements (job_id);
create index stock_movements_created_at_idx on public.stock_movements (created_at);

-- material_id y job_id (si existe) deben pertenecer a organization_id.
create or replace function public.check_stock_movement_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  material_org uuid;
  job_org uuid;
begin
  select organization_id into material_org from public.materials where id = new.material_id;
  if material_org is null or material_org <> new.organization_id then
    raise exception 'material_id no pertenece a organization_id';
  end if;

  if new.job_id is not null then
    select organization_id into job_org from public.jobs where id = new.job_id;
    if job_org is null or job_org <> new.organization_id then
      raise exception 'job_id no pertenece a organization_id';
    end if;
  end if;

  return new;
end;
$$;

create trigger stock_movements_check_org_consistency
  before insert or update on public.stock_movements
  for each row execute function public.check_stock_movement_org_consistency();

-- Movimientos inmutables: sin updated_at, y no se permite editar ni borrar
-- desde la app (ver RLS) para preservar la trazabilidad contable del stock.

-- Balance de stock derivado, nunca almacenado. security_invoker es
-- necesario para que la vista respete RLS del usuario que consulta (por
-- defecto una vista corre con los permisos de quien la creó y bypassea RLS).
create view public.material_stock_balances
with (security_invoker = true) as
select
  material_id,
  organization_id,
  sum(
    case
      when movement_type in ('in', 'return', 'adjustment_in') then quantity
      when movement_type in ('consumption', 'adjustment_out') then -quantity
      else 0
    end
  ) as current_stock
from public.stock_movements
group by material_id, organization_id;

-- ---------------------------------------------------------------------------
-- job_materials (necesidad de materiales de un trabajo)
-- ---------------------------------------------------------------------------
create table public.job_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete restrict,
  estimated_quantity numeric(14, 3) not null check (estimated_quantity > 0),
  actual_quantity numeric(14, 3) check (actual_quantity is null or actual_quantity >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, material_id)
);

create index job_materials_org_idx on public.job_materials (organization_id);
create index job_materials_job_idx on public.job_materials (job_id);
create index job_materials_material_idx on public.job_materials (material_id);

create trigger job_materials_set_updated_at
  before update on public.job_materials
  for each row execute function public.set_updated_at();

-- job_id y material_id deben pertenecer a organization_id (evita
-- "job org A + material org B", que RLS por sí sola no garantiza).
create or replace function public.check_job_material_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_org uuid;
  material_org uuid;
begin
  select organization_id into job_org from public.jobs where id = new.job_id;
  if job_org is null or job_org <> new.organization_id then
    raise exception 'job_id no pertenece a organization_id';
  end if;

  select organization_id into material_org from public.materials where id = new.material_id;
  if material_org is null or material_org <> new.organization_id then
    raise exception 'material_id no pertenece a organization_id';
  end if;

  return new;
end;
$$;

create trigger job_materials_check_org_consistency
  before insert or update on public.job_materials
  for each row execute function public.check_job_material_org_consistency();
