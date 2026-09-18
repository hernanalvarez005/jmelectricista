-- Fase 3: medios de pago, cuentas de cobro y cobros de trabajo.

-- ---------------------------------------------------------------------------
-- payment_methods (configurable por organización)
-- ---------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  requires_account boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index payment_methods_org_active_idx on public.payment_methods (organization_id, active);

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_accounts (configurable por organización)
-- ---------------------------------------------------------------------------
create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  account_type text not null check (account_type in ('cash', 'bank', 'wallet', 'other')),
  bank_name text,
  alias text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index payment_accounts_org_active_idx on public.payment_accounts (organization_id, active);

create trigger payment_accounts_set_updated_at
  before update on public.payment_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_payments (append-only; se corrige con anulación, nunca con update/delete)
-- ---------------------------------------------------------------------------
create table public.job_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete restrict,
  payment_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  payment_account_id uuid references public.payment_accounts (id) on delete restrict,
  reference text,
  notes text,
  receipt_path text,
  -- Idempotencia: el cliente genera un UUID una única vez por intento de
  -- carga; reenviar el mismo formulario (doble click, retry, refresh) manda
  -- el mismo client_request_id y nunca crea un segundo cobro (ver
  -- register_job_payment).
  client_request_id uuid not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text,
  unique (organization_id, client_request_id),
  constraint job_payments_void_reason_with_voided_at check (
    (voided_at is null and void_reason is null) or (voided_at is not null and void_reason is not null)
  )
);

create index job_payments_org_date_idx on public.job_payments (organization_id, payment_date);
create index job_payments_job_idx on public.job_payments (job_id);
create index job_payments_method_idx on public.job_payments (payment_method_id);
create index job_payments_account_idx on public.job_payments (payment_account_id);
create index job_payments_voided_idx on public.job_payments (voided_at);

-- job_id / payment_method_id / payment_account_id (si existe) deben
-- pertenecer a organization_id, y si el método requiere cuenta, la cuenta es
-- obligatoria. Se valida acá (no solo en el RPC/frontend) para que ningún
-- camino de escritura pueda saltarse la regla.
create or replace function public.check_job_payment_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_org uuid;
  method_org uuid;
  method_requires_account boolean;
  account_org uuid;
begin
  select organization_id into job_org from public.jobs where id = new.job_id;
  if job_org is null or job_org <> new.organization_id then
    raise exception 'job_id no pertenece a organization_id';
  end if;

  select organization_id, requires_account into method_org, method_requires_account
  from public.payment_methods where id = new.payment_method_id;
  if method_org is null or method_org <> new.organization_id then
    raise exception 'payment_method_id no pertenece a organization_id';
  end if;

  if new.payment_account_id is not null then
    select organization_id into account_org from public.payment_accounts where id = new.payment_account_id;
    if account_org is null or account_org <> new.organization_id then
      raise exception 'payment_account_id no pertenece a organization_id';
    end if;
  elsif method_requires_account then
    raise exception 'este medio de pago requiere una cuenta';
  end if;

  return new;
end;
$$;

create trigger job_payments_check_org_consistency
  before insert or update on public.job_payments
  for each row execute function public.check_job_payment_org_consistency();

-- ---------------------------------------------------------------------------
-- register_job_payment: alta idempotente (única forma de crear un cobro;
-- no hay policy de INSERT directa sobre job_payments).
-- ---------------------------------------------------------------------------
create or replace function public.register_job_payment(
  p_job_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method_id uuid,
  p_payment_account_id uuid,
  p_reference text,
  p_notes text,
  p_receipt_path text,
  p_client_request_id uuid
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

  insert into public.job_payments (
    organization_id, job_id, payment_date, amount, payment_method_id,
    payment_account_id, reference, notes, receipt_path, client_request_id, created_by
  )
  values (
    v_org, p_job_id, p_payment_date, p_amount, p_payment_method_id,
    p_payment_account_id, p_reference, p_notes, p_receipt_path, p_client_request_id, auth.uid()
  )
  on conflict (organization_id, client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Ya existía (reenvío del mismo client_request_id): devolver el mismo id,
    -- nunca crear un segundo movimiento.
    select id into v_id from public.job_payments
    where organization_id = v_org and client_request_id = p_client_request_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.register_job_payment(uuid, date, numeric, uuid, uuid, text, text, text, uuid) from public;
grant execute on function public.register_job_payment(uuid, date, numeric, uuid, uuid, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- void_job_payment: anulación auditada (única forma de "corregir" un cobro;
-- no hay policy de UPDATE directa sobre job_payments). Requiere admin/owner:
-- anular dinero ya registrado es más sensible que registrarlo, mismo criterio
-- que el resto de la configuración administrativa del sistema.
-- ---------------------------------------------------------------------------
create or replace function public.void_job_payment(p_payment_id uuid, p_void_reason text)
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
  from public.job_payments
  where id = p_payment_id
  for update;

  if v_org is null then
    raise exception 'cobro no encontrado';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'not authorized';
  end if;

  if v_voided_at is not null then
    raise exception 'este cobro ya fue anulado';
  end if;

  if p_void_reason is null or length(trim(p_void_reason)) = 0 then
    raise exception 'el motivo de anulación es obligatorio';
  end if;

  update public.job_payments
  set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_void_reason)
  where id = p_payment_id;
end;
$$;

revoke all on function public.void_job_payment(uuid, text) from public;
grant execute on function public.void_job_payment(uuid, text) to authenticated;
