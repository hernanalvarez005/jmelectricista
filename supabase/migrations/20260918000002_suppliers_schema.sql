-- Fase 2: proveedores y precios (historial completo, nunca solo el último).

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index suppliers_org_idx on public.suppliers (organization_id);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- supplier_material_prices (historial; jamás se actualiza un precio viejo)
-- ---------------------------------------------------------------------------
create table public.supplier_material_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  material_id uuid not null references public.materials (id) on delete restrict,
  price numeric(14, 2) not null check (price >= 0),
  currency text not null default 'ARS',
  recorded_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index supplier_material_prices_org_idx on public.supplier_material_prices (organization_id);
create index supplier_material_prices_supplier_idx on public.supplier_material_prices (supplier_id);
create index supplier_material_prices_material_idx
  on public.supplier_material_prices (material_id, recorded_at desc);

-- supplier_id y material_id deben pertenecer a organization_id.
create or replace function public.check_supplier_price_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier_org uuid;
  material_org uuid;
begin
  select organization_id into supplier_org from public.suppliers where id = new.supplier_id;
  if supplier_org is null or supplier_org <> new.organization_id then
    raise exception 'supplier_id no pertenece a organization_id';
  end if;

  select organization_id into material_org from public.materials where id = new.material_id;
  if material_org is null or material_org <> new.organization_id then
    raise exception 'material_id no pertenece a organization_id';
  end if;

  return new;
end;
$$;

create trigger supplier_material_prices_check_org_consistency
  before insert or update on public.supplier_material_prices
  for each row execute function public.check_supplier_price_org_consistency();

-- Último precio conocido por material, derivado (no duplicado en materials).
create view public.material_latest_prices
with (security_invoker = true) as
select distinct on (material_id)
  material_id,
  organization_id,
  supplier_id,
  price,
  currency,
  recorded_at
from public.supplier_material_prices
order by material_id, recorded_at desc, created_at desc;
