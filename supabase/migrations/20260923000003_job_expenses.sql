-- Fase 5: gastos directos de un trabajo (estacionamiento, flete, alquiler de
-- herramienta, subcontratación, viáticos...).
--
-- Un gasto es un registro auditable e inmutable, igual que un cobro: no se edita
-- el importe/trabajo/fecha/categoría; se corrige anulando (con motivo, owner/admin)
-- y cargando uno nuevo. El alta es idempotente por client_request_id y solo pasa
-- por el RPC register_job_expense.

create table public.job_expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index job_expense_categories_org_active_idx
  on public.job_expense_categories (organization_id, active);

create trigger job_expense_categories_set_updated_at
  before update on public.job_expense_categories
  for each row execute function public.set_updated_at();

create table public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete restrict,
  category_id uuid not null references public.job_expense_categories (id) on delete restrict,
  expense_date date not null,
  description text not null check (length(trim(description)) > 0),
  amount numeric(14, 2) not null check (amount > 0),
  receipt_path text,
  client_request_id uuid not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text,
  unique (organization_id, client_request_id),
  constraint job_expenses_void_reason_with_voided_at check (
    (voided_at is null and void_reason is null) or (voided_at is not null and void_reason is not null)
  )
);

create index job_expenses_org_job_idx on public.job_expenses (organization_id, job_id);
create index job_expenses_job_active_idx on public.job_expenses (job_id) where voided_at is null;
create index job_expenses_org_date_idx on public.job_expenses (organization_id, expense_date);
create index job_expenses_category_idx on public.job_expenses (category_id);

-- job y categoría deben ser de la misma organización (no solo por RLS).
create or replace function public.check_job_expense_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_org uuid;
begin
  select organization_id into ref_org from public.jobs where id = new.job_id;
  if ref_org is null or ref_org <> new.organization_id then
    raise exception 'job_id no pertenece a organization_id';
  end if;

  select organization_id into ref_org from public.job_expense_categories where id = new.category_id;
  if ref_org is null or ref_org <> new.organization_id then
    raise exception 'category_id no pertenece a organization_id';
  end if;

  return new;
end;
$$;

create trigger job_expenses_check_org_consistency
  before insert on public.job_expenses
  for each row execute function public.check_job_expense_org_consistency();

-- Inmutabilidad: lo único que puede cambiar es la anulación (una sola vez, y
-- con motivo). Un gasto nunca se borra.
create or replace function public.guard_job_expense_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'un gasto registrado no se elimina: se anula';
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.job_id is distinct from old.job_id
     or new.category_id is distinct from old.category_id
     or new.expense_date is distinct from old.expense_date
     or new.description is distinct from old.description
     or new.amount is distinct from old.amount
     or new.receipt_path is distinct from old.receipt_path
     or new.client_request_id is distinct from old.client_request_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'un gasto registrado no se edita: se anula y se carga uno nuevo';
  end if;

  if old.voided_at is not null
     and (new.voided_at is distinct from old.voided_at
          or new.voided_by is distinct from old.voided_by
          or new.void_reason is distinct from old.void_reason) then
    raise exception 'este gasto ya fue anulado';
  end if;

  return new;
end;
$$;

create trigger job_expenses_guard_mutation
  before update or delete on public.job_expenses
  for each row execute function public.guard_job_expense_mutation();

-- ---------------------------------------------------------------------------
-- register_job_expense: alta idempotente. Worker/operator puede registrar.
-- ---------------------------------------------------------------------------
create or replace function public.register_job_expense(
  p_job_id uuid,
  p_category_id uuid,
  p_expense_date date,
  p_description text,
  p_amount numeric,
  p_client_request_id uuid,
  p_receipt_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select organization_id into v_org from public.jobs where id = p_job_id;
  if v_org is null then
    raise exception 'trabajo no encontrado';
  end if;

  if not public.is_org_operator(v_org) then
    raise exception 'not authorized';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount debe ser mayor a 0';
  end if;

  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'la descripción es obligatoria';
  end if;

  if p_client_request_id is null then
    raise exception 'client_request_id es obligatorio';
  end if;

  insert into public.job_expenses (
    organization_id, job_id, category_id, expense_date, description, amount,
    receipt_path, client_request_id, created_by
  )
  values (
    v_org, p_job_id, p_category_id, p_expense_date, trim(p_description), p_amount,
    p_receipt_path, p_client_request_id, auth.uid()
  )
  on conflict (organization_id, client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.job_expenses
    where organization_id = v_org and client_request_id = p_client_request_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.register_job_expense(uuid, uuid, date, text, numeric, uuid, text) from public, anon;
grant execute on function public.register_job_expense(uuid, uuid, date, text, numeric, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- void_job_expense: anulación auditada, solo owner/admin y con motivo.
-- ---------------------------------------------------------------------------
create or replace function public.void_job_expense(p_expense_id uuid, p_void_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_voided_at timestamptz;
begin
  select organization_id, voided_at into v_org, v_voided_at
  from public.job_expenses where id = p_expense_id for update;

  if v_org is null then
    raise exception 'gasto no encontrado';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'not authorized';
  end if;

  if v_voided_at is not null then
    raise exception 'este gasto ya fue anulado';
  end if;

  if p_void_reason is null or length(trim(p_void_reason)) = 0 then
    raise exception 'el motivo de anulación es obligatorio';
  end if;

  update public.job_expenses
  set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_void_reason)
  where id = p_expense_id;
end;
$$;

revoke all on function public.void_job_expense(uuid, text) from public, anon;
grant execute on function public.void_job_expense(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS.
--   categorías: catálogo de configuración -> lectura para miembros, escritura admin.
--   gastos: lectura para miembros (viewer solo lectura); alta/anulación solo por RPC.
-- ---------------------------------------------------------------------------
alter table public.job_expense_categories enable row level security;

create policy job_expense_categories_select on public.job_expense_categories
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy job_expense_categories_insert on public.job_expense_categories
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy job_expense_categories_update on public.job_expense_categories
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy job_expense_categories_delete on public.job_expense_categories
  for delete to authenticated
  using (public.is_org_admin(organization_id));

alter table public.job_expenses enable row level security;

create policy job_expenses_select on public.job_expenses
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Storage: comprobantes de gasto (bucket privado).
-- Path: organizations/{organization_id}/jobs/{job_id}/expenses/{client_request_id}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('job-expense-receipts', 'job-expense-receipts', false)
on conflict (id) do nothing;

create policy job_expense_receipts_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-expense-receipts'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_member(((storage.foldername(name))[2])::uuid)
  );

create policy job_expense_receipts_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-expense-receipts'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_operator(((storage.foldername(name))[2])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Categorías por defecto: organizaciones existentes y futuras.
-- ---------------------------------------------------------------------------
insert into public.job_expense_categories (organization_id, name, sort_order)
select o.id, c.name, c.sort_order
from public.organizations o
cross join (
  values
    ('Traslado', 10),
    ('Peaje / estacionamiento', 20),
    ('Alquiler', 30),
    ('Viáticos', 40),
    ('Subcontratación', 50),
    ('Otro', 60)
) as c(name, sort_order)
on conflict (organization_id, name) do nothing;

-- bootstrap_organization: misma definición vigente + categorías de gasto.
create or replace function public.bootstrap_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  new_slug text;
  uid uuid := auth.uid();
  wd int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if org_name is null or length(trim(org_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  new_slug := public.generate_org_slug(org_name);

  insert into public.organizations (name, slug)
  values (trim(org_name), new_slug)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role, active)
  values (new_org_id, uid, 'owner', true);

  insert into public.job_statuses (organization_id, name, slug, sort_order, is_closed, active)
  values
    (new_org_id, 'Consulta', 'consulta', 10, false, true),
    (new_org_id, 'Visita pendiente', 'visita-pendiente', 20, false, true),
    (new_org_id, 'Cotizar', 'cotizar', 30, false, true),
    (new_org_id, 'Presupuesto enviado', 'presupuesto-enviado', 40, false, true),
    (new_org_id, 'Aceptado', 'aceptado', 50, false, true),
    (new_org_id, 'Esperando materiales', 'esperando-materiales', 60, false, true),
    (new_org_id, 'Listo para programar', 'listo-para-programar', 70, false, true),
    (new_org_id, 'Programado', 'programado', 80, false, true),
    (new_org_id, 'En ejecución', 'en-ejecucion', 90, false, true),
    (new_org_id, 'Finalizado', 'finalizado', 100, true, true),
    (new_org_id, 'Cobrado', 'cobrado', 110, true, true);

  insert into public.job_types (organization_id, name, description, default_estimated_minutes, active)
  values
    (new_org_id, 'Visita / relevamiento', 'Visita de diagnóstico o relevamiento previo a cotizar', 60, true),
    (new_org_id, 'Reparación', 'Reparación puntual de una falla', 90, true),
    (new_org_id, 'Instalación', 'Instalación de artefactos o puntos eléctricos', 180, true),
    (new_org_id, 'Instalación de tablero', 'Instalación o recambio de tablero eléctrico', 240, true),
    (new_org_id, 'Trabajo de obra', 'Trabajo de instalación eléctrica completa en obra', 480, true);

  insert into public.material_units (organization_id, name, symbol)
  values
    (new_org_id, 'Unidad', 'u'),
    (new_org_id, 'Metro', 'm'),
    (new_org_id, 'Rollo', 'rollo'),
    (new_org_id, 'Caja', 'caja'),
    (new_org_id, 'Kilogramo', 'kg'),
    (new_org_id, 'Litro', 'l');

  insert into public.payment_methods (organization_id, name, requires_account, sort_order)
  values
    (new_org_id, 'Efectivo', false, 10),
    (new_org_id, 'Transferencia', true, 20),
    (new_org_id, 'Tarjeta', true, 30),
    (new_org_id, 'Otro', false, 40);

  insert into public.payment_accounts (organization_id, name, account_type)
  values (new_org_id, 'Efectivo', 'cash');

  insert into public.job_expense_categories (organization_id, name, sort_order)
  values
    (new_org_id, 'Traslado', 10),
    (new_org_id, 'Peaje / estacionamiento', 20),
    (new_org_id, 'Alquiler', 30),
    (new_org_id, 'Viáticos', 40),
    (new_org_id, 'Subcontratación', 50),
    (new_org_id, 'Otro', 60);

  for wd in 0..6 loop
    if wd between 1 and 5 then
      insert into public.business_hours (organization_id, weekday, is_working_day, start_time, end_time)
      values (new_org_id, wd, true, time '08:00', time '17:00');
    else
      insert into public.business_hours (organization_id, weekday, is_working_day, start_time, end_time)
      values (new_org_id, wd, false, null, null);
    end if;
  end loop;

  return new_org_id;
end;
$$;
