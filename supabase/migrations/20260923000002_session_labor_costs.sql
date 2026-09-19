-- Fase 5: costo de mano de obra por sesión con tarifa congelada (snapshot).
--
--   actual_minutes = (actual_end_at - actual_start_at) en minutos
--   labor_cost     = actual_minutes / 60 * hourly_cost_snapshot
--
-- El snapshot se captura UNA vez (job_session_id es único) cuando la sesión tiene
-- tiempo real y responsable, con la tarifa vigente en la fecha local (zona de la
-- organización) del inicio real. Si después se corrige la duración, el costo se
-- recalcula con el MISMO snapshot; una tarifa posterior nunca lo reprecifica.
--
-- El snapshot vive en una tabla aparte (no en job_sessions) para que quienes ya
-- pueden leer sesiones (worker/viewer) no puedan leer el costo. Solo owner/admin
-- lo leen; solo lo escriben triggers/RPC SECURITY DEFINER.

create table public.job_session_labor_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_session_id uuid not null unique references public.job_sessions (id) on delete cascade,
  organization_member_id uuid not null references public.organization_members (id) on delete restrict,
  labor_rate_id uuid references public.member_labor_rates (id) on delete restrict,
  hourly_cost_snapshot numeric(14, 2) not null check (hourly_cost_snapshot >= 0),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_session_labor_costs_org_idx on public.job_session_labor_costs (organization_id);
create index job_session_labor_costs_member_idx on public.job_session_labor_costs (organization_member_id);
create index job_session_labor_costs_rate_idx on public.job_session_labor_costs (labor_rate_id);

create trigger job_session_labor_costs_set_updated_at
  before update on public.job_session_labor_costs
  for each row execute function public.set_updated_at();

-- Integridad cross-org: sesión, miembro y tarifa deben ser de la misma organización
-- (y la tarifa, del mismo miembro).
create or replace function public.check_job_session_labor_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_org uuid;
  ref_member uuid;
begin
  select organization_id into ref_org from public.job_sessions where id = new.job_session_id;
  if ref_org is null or ref_org <> new.organization_id then
    raise exception 'job_session_id no pertenece a organization_id';
  end if;

  select organization_id into ref_org from public.organization_members where id = new.organization_member_id;
  if ref_org is null or ref_org <> new.organization_id then
    raise exception 'organization_member_id no pertenece a organization_id';
  end if;

  if new.labor_rate_id is not null then
    select organization_id, organization_member_id into ref_org, ref_member
    from public.member_labor_rates where id = new.labor_rate_id;
    if ref_org is null or ref_org <> new.organization_id or ref_member <> new.organization_member_id then
      raise exception 'labor_rate_id no pertenece a organization_id / organization_member_id';
    end if;
  end if;

  return new;
end;
$$;

create trigger job_session_labor_costs_check
  before insert or update on public.job_session_labor_costs
  for each row execute function public.check_job_session_labor_cost();

-- ---------------------------------------------------------------------------
-- Captura del snapshot (uso interno). Devuelve true si creó uno.
--   * sin responsable, sin tiempo real o cancelada -> no captura
--   * con snapshot existente -> no toca nada (idempotente)
--   * sin tarifa vigente en la fecha -> no captura (queda "costo no configurado";
--     nunca se asume 0 ni se usa la tarifa actual/futura)
-- ---------------------------------------------------------------------------
create or replace function public.capture_session_labor_cost(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_tz text;
  v_date date;
  v_rate record;
  v_inserted uuid;
begin
  select id, organization_id, assigned_member_id, actual_start_at, actual_end_at, status
  into s
  from public.job_sessions where id = p_session_id;

  if not found or s.assigned_member_id is null or s.actual_start_at is null
     or s.actual_end_at is null or s.status = 'cancelled' then
    return false;
  end if;

  if exists (select 1 from public.job_session_labor_costs where job_session_id = s.id) then
    return false;
  end if;

  select timezone into v_tz from public.organizations where id = s.organization_id;
  v_date := (s.actual_start_at at time zone v_tz)::date;

  select rate_id, hourly_cost into v_rate from public.resolve_labor_rate(s.assigned_member_id, v_date);
  if not found then
    return false;
  end if;

  insert into public.job_session_labor_costs (
    organization_id, job_session_id, organization_member_id, labor_rate_id, hourly_cost_snapshot
  )
  values (s.organization_id, s.id, s.assigned_member_id, v_rate.rate_id, v_rate.hourly_cost)
  on conflict (job_session_id) do nothing
  returning id into v_inserted;

  return v_inserted is not null;
end;
$$;

revoke all on function public.capture_session_labor_cost(uuid) from public, anon, authenticated;

create or replace function public.job_sessions_capture_labor_cost_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.capture_session_labor_cost(new.id);
  return null;
end;
$$;

create trigger job_sessions_capture_labor_cost
  after insert or update of actual_start_at, actual_end_at, assigned_member_id, status on public.job_sessions
  for each row
  when (new.actual_start_at is not null and new.actual_end_at is not null and new.assigned_member_id is not null)
  execute function public.job_sessions_capture_labor_cost_trigger();

-- ---------------------------------------------------------------------------
-- Cambio de responsable: una vez que la sesión tiene tiempo real o costo, no se
-- puede cambiar directamente (quedaría un costo de otra persona). La corrección
-- explícita es reassign_session_member (owner/admin). Asignar responsable a una
-- sesión que no tenía ninguno sí está permitido.
-- ---------------------------------------------------------------------------
create or replace function public.guard_session_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.assigned_member_id is not null
     and new.assigned_member_id is distinct from old.assigned_member_id
     and (
       old.actual_start_at is not null
       or exists (select 1 from public.job_session_labor_costs where job_session_id = old.id)
     )
     and current_setting('app.reassign_session', true) is distinct from 'on' then
    raise exception 'responsable_bloqueado: la sesión ya tiene tiempo real o costo; el cambio de responsable lo hace un administrador desde Costos';
  end if;
  return new;
end;
$$;

create trigger job_sessions_guard_member_change
  before update of assigned_member_id on public.job_sessions
  for each row execute function public.guard_session_member_change();

-- ---------------------------------------------------------------------------
-- reassign_session_member (owner/admin): cambia el responsable, descarta el
-- snapshot anterior y captura uno nuevo con la tarifa histórica del nuevo
-- responsable, si existe. Devuelve 'costed' | 'no_rate' | 'no_time'.
-- ---------------------------------------------------------------------------
create or replace function public.reassign_session_member(p_session_id uuid, p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_member_org uuid;
  v_has_time boolean;
begin
  select organization_id, (actual_start_at is not null and actual_end_at is not null)
  into v_org, v_has_time
  from public.job_sessions where id = p_session_id for update;

  if v_org is null then
    raise exception 'sesión no encontrada';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'not authorized';
  end if;

  select organization_id into v_member_org from public.organization_members where id = p_member_id;
  if v_member_org is null or v_member_org <> v_org then
    raise exception 'el miembro no pertenece a la organización';
  end if;

  perform set_config('app.reassign_session', 'on', true);
  delete from public.job_session_labor_costs where job_session_id = p_session_id;
  update public.job_sessions set assigned_member_id = p_member_id where id = p_session_id;

  if not v_has_time then
    return 'no_time';
  end if;
  if exists (select 1 from public.job_session_labor_costs where job_session_id = p_session_id) then
    return 'costed';
  end if;
  return 'no_rate';
end;
$$;

revoke all on function public.reassign_session_member(uuid, uuid) from public, anon;
grant execute on function public.reassign_session_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- backfill_session_labor_costs (owner/admin): acción explícita para valorizar
-- sesiones históricas que tienen tiempo real y responsable pero ningún snapshot
-- (p.ej. tras cargar una tarifa con vigencia pasada). Nunca modifica snapshots
-- existentes. Devuelve la cantidad de sesiones valorizadas.
-- ---------------------------------------------------------------------------
create or replace function public.backfill_session_labor_costs(
  p_organization_id uuid,
  p_member_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  n integer := 0;
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'not authorized';
  end if;

  for s in
    select js.id
    from public.job_sessions js
    where js.organization_id = p_organization_id
      and js.assigned_member_id is not null
      and (p_member_id is null or js.assigned_member_id = p_member_id)
      and js.actual_start_at is not null
      and js.actual_end_at is not null
      and js.status <> 'cancelled'
      and not exists (select 1 from public.job_session_labor_costs c where c.job_session_id = js.id)
    order by js.actual_start_at
  loop
    if public.capture_session_labor_cost(s.id) then
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

revoke all on function public.backfill_session_labor_costs(uuid, uuid) from public, anon;
grant execute on function public.backfill_session_labor_costs(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_member_labor_rate (owner/admin): solo tarifas que nunca se usaron en un
-- snapshot. Reabre el período anterior para no dejar un hueco.
-- ---------------------------------------------------------------------------
create or replace function public.delete_member_labor_rate(p_rate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.member_labor_rates%rowtype;
begin
  select * into r from public.member_labor_rates where id = p_rate_id;
  if not found then
    raise exception 'tarifa no encontrada';
  end if;

  perform 1 from public.organization_members where id = r.organization_member_id for update;

  if not public.is_org_admin(r.organization_id) then
    raise exception 'not authorized';
  end if;

  if exists (select 1 from public.job_session_labor_costs where labor_rate_id = p_rate_id) then
    raise exception 'tarifa_en_uso: la tarifa ya se usó para valorizar sesiones y no se puede eliminar';
  end if;

  delete from public.member_labor_rates where id = p_rate_id;

  update public.member_labor_rates
  set valid_to = r.valid_to
  where organization_member_id = r.organization_member_id
    and valid_to = r.valid_from - 1;
end;
$$;

revoke all on function public.delete_member_labor_rate(uuid) from public, anon;
grant execute on function public.delete_member_labor_rate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: información salarial sensible -> solo owner/admin.
-- ---------------------------------------------------------------------------
alter table public.job_session_labor_costs enable row level security;

create policy job_session_labor_costs_select on public.job_session_labor_costs
  for select to authenticated
  using (public.is_org_admin(organization_id));

-- Para análisis por día de la semana (sesiones con tiempo real por fecha de inicio).
create index job_sessions_org_actual_start_idx
  on public.job_sessions (organization_id, actual_start_at)
  where actual_start_at is not null;
