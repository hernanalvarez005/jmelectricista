-- Fase 5.1: estado de facturación por trabajo, INDEPENDIENTE del estado del trabajo y del
-- estado de cobro. "Facturado" es una marca operativa interna (JM registró que el comprobante
-- fue emitido); no implica validación ARCA ni CAE.
--
-- Estrategia: si un trabajo no tiene fila en job_billing su estado derivado es 'pending'; la
-- fila se crea recién al facturar. Toda escritura pasa por RPC (owner/admin) y queda en
-- job_billing_history (nunca se borra).

create table public.job_billing (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  status text not null check (status in ('pending', 'invoiced')),
  invoiced_at date,
  invoice_number text,
  notes text,
  marked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_billing_invoiced_has_date check (status <> 'invoiced' or invoiced_at is not null)
);

create index job_billing_org_status_idx on public.job_billing (organization_id, status);

create trigger job_billing_set_updated_at
  before update on public.job_billing
  for each row execute function public.set_updated_at();

create table public.job_billing_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  from_status text check (from_status in ('pending', 'invoiced')),
  to_status text not null check (to_status in ('pending', 'invoiced')),
  invoiced_at date,
  invoice_number text,
  notes text,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index job_billing_history_job_idx on public.job_billing_history (job_id, changed_at desc);
create index job_billing_history_org_idx on public.job_billing_history (organization_id);

-- El trabajo debe pertenecer a la organización (no solo por RLS).
create or replace function public.check_job_billing_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.jobs where id = new.job_id;
  if v_org is null or v_org <> new.organization_id then
    raise exception 'job_id no pertenece a organization_id';
  end if;
  return new;
end;
$$;

create trigger job_billing_check_org
  before insert or update on public.job_billing
  for each row execute function public.check_job_billing_org();

create trigger job_billing_history_check_org
  before insert on public.job_billing_history
  for each row execute function public.check_job_billing_org();

-- La historia es un registro de auditoría: no se edita ni se borra.
create or replace function public.guard_job_billing_history()
returns trigger
language plpgsql
as $$
begin
  raise exception 'el historial de facturación no se edita ni se elimina';
end;
$$;

create trigger job_billing_history_immutable
  before update or delete on public.job_billing_history
  for each row execute function public.guard_job_billing_history();

-- ---------------------------------------------------------------------------
-- Marcar como facturado (owner/admin). También permite corregir número/fecha/observaciones
-- de un trabajo ya facturado (queda en el historial). No toca el estado del trabajo, los
-- cobros ni la cotización.
-- ---------------------------------------------------------------------------
create or replace function public.mark_job_invoiced(
  p_job_id uuid,
  p_invoiced_at date,
  p_invoice_number text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_from text;
  v_number text := nullif(trim(p_invoice_number), '');
  v_notes text := nullif(trim(p_notes), '');
begin
  select organization_id into v_org from public.jobs where id = p_job_id for update;
  if v_org is null then
    raise exception 'trabajo no encontrado';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'not authorized';
  end if;

  if p_invoiced_at is null then
    raise exception 'la fecha de facturación es obligatoria';
  end if;

  select status into v_from from public.job_billing where job_id = p_job_id;

  insert into public.job_billing (organization_id, job_id, status, invoiced_at, invoice_number, notes, marked_by)
  values (v_org, p_job_id, 'invoiced', p_invoiced_at, v_number, v_notes, auth.uid())
  on conflict (job_id) do update
    set status = 'invoiced', invoiced_at = excluded.invoiced_at, invoice_number = excluded.invoice_number,
        notes = excluded.notes, marked_by = excluded.marked_by;

  insert into public.job_billing_history (organization_id, job_id, from_status, to_status, invoiced_at, invoice_number, notes, changed_by)
  values (v_org, p_job_id, coalesce(v_from, 'pending'), 'invoiced', p_invoiced_at, v_number, v_notes, auth.uid());
end;
$$;

revoke all on function public.mark_job_invoiced(uuid, date, text, text) from public, anon;
grant execute on function public.mark_job_invoiced(uuid, date, text, text) to authenticated;

-- Volver a pendiente (owner/admin). El historial conserva el número y la fecha anteriores.
create or replace function public.revert_job_billing(p_job_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_billing public.job_billing;
begin
  select organization_id into v_org from public.jobs where id = p_job_id for update;
  if v_org is null then
    raise exception 'trabajo no encontrado';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'not authorized';
  end if;

  select * into v_billing from public.job_billing where job_id = p_job_id;
  if not found or v_billing.status <> 'invoiced' then
    raise exception 'el trabajo no está marcado como facturado';
  end if;

  update public.job_billing
  set status = 'pending', invoiced_at = null, invoice_number = null, notes = nullif(trim(p_notes), ''), marked_by = auth.uid()
  where job_id = p_job_id;

  insert into public.job_billing_history (organization_id, job_id, from_status, to_status, invoiced_at, invoice_number, notes, changed_by)
  values (v_org, p_job_id, 'invoiced', 'pending', v_billing.invoiced_at, v_billing.invoice_number, nullif(trim(p_notes), ''), auth.uid());
end;
$$;

revoke all on function public.revert_job_billing(uuid, text) from public, anon;
grant execute on function public.revert_job_billing(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: el estado lo ve todo miembro; el historial solo owner/admin. Sin escritura directa.
-- ---------------------------------------------------------------------------
alter table public.job_billing enable row level security;
alter table public.job_billing_history enable row level security;

create policy job_billing_select on public.job_billing
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy job_billing_history_select on public.job_billing_history
  for select to authenticated
  using (public.is_org_admin(organization_id));

revoke all on table public.job_billing from anon;
revoke all on table public.job_billing_history from anon;
