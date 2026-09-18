-- Fase 3.1: creación idempotente de sesiones.
-- Un doble click / retry creaba dos sesiones idénticas. La protección real
-- vive en la DB: el cliente genera un client_request_id (UUID) al abrir el
-- diálogo y lo reenvía en cada intento; el mismo id nunca crea una segunda
-- sesión. NO hay unique por (job, inicio, fin): dos sesiones iguales pero con
-- request distinto pueden ser una acción voluntaria.
alter table public.job_sessions add column client_request_id uuid;

-- Con NULLs distintos (default de Postgres) las sesiones históricas sin id no
-- colisionan entre sí.
create unique index job_sessions_client_request_uidx
  on public.job_sessions (organization_id, client_request_id)
  where client_request_id is not null;

-- job_id y assigned_member_id deben pertenecer a organization_id (RLS por sí
-- sola no lo garantiza).
create or replace function public.check_job_session_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_org uuid;
  member_org uuid;
begin
  select organization_id into job_org from public.jobs where id = new.job_id;
  if job_org is null or job_org <> new.organization_id then
    raise exception 'job_id no pertenece a organization_id';
  end if;

  if new.assigned_member_id is not null then
    select organization_id into member_org from public.organization_members where id = new.assigned_member_id;
    if member_org is null or member_org <> new.organization_id then
      raise exception 'assigned_member_id no pertenece a organization_id';
    end if;
  end if;

  return new;
end;
$$;

create trigger job_sessions_check_org_consistency
  before insert or update on public.job_sessions
  for each row execute function public.check_job_session_org_consistency();

create or replace function public.create_job_session(
  p_job_id uuid,
  p_planned_start_at timestamptz,
  p_planned_end_at timestamptz,
  p_client_request_id uuid,
  p_assigned_member_id uuid default null,
  p_notes text default null
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

  if p_client_request_id is null then
    raise exception 'client_request_id es obligatorio';
  end if;

  if p_planned_end_at <= p_planned_start_at then
    raise exception 'planned_end_at debe ser posterior a planned_start_at';
  end if;

  insert into public.job_sessions (
    organization_id, job_id, assigned_member_id, planned_start_at, planned_end_at, notes, client_request_id
  )
  values (v_org, p_job_id, p_assigned_member_id, p_planned_start_at, p_planned_end_at, p_notes, p_client_request_id)
  on conflict (organization_id, client_request_id) where client_request_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    -- Reenvío del mismo request: devolver la sesión ya creada.
    select id into v_id from public.job_sessions
    where organization_id = v_org and client_request_id = p_client_request_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_job_session(uuid, timestamptz, timestamptz, uuid, uuid, text) from public;
grant execute on function public.create_job_session(uuid, timestamptz, timestamptz, uuid, uuid, text) to authenticated;

-- La creación pasa siempre por create_job_session (mismo criterio que
-- create_quote / register_job_payment): sin policy de INSERT directa.
drop policy job_sessions_insert on public.job_sessions;
