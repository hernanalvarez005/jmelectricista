-- Fase 5: tarifas internas de mano de obra con vigencia (costo por hora).
--
-- Una persona puede tener un costo hora distinto a lo largo del tiempo, y un
-- trabajo ya realizado NO debe cambiar cuando se modifica la tarifa. Por eso la
-- tarifa vive en períodos (valid_from / valid_to) y nunca como una columna del
-- miembro. hourly_cost = 0 es una tarifa explícita ("no imputar costo laboral a
-- esta persona") y es distinto de "sin tarifa configurada" (no hay fila).
--
-- Privacidad: solo owner/admin leen o administran tarifas. Se escribe únicamente
-- por RPC (SECURITY DEFINER); no hay policy de INSERT/UPDATE/DELETE directa.

create table public.member_labor_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  organization_member_id uuid not null references public.organization_members (id) on delete cascade,
  hourly_cost numeric(14, 2) not null check (hourly_cost >= 0),
  valid_from date not null,
  valid_to date,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_labor_rates_valid_range check (valid_to is null or valid_to >= valid_from)
);

create index member_labor_rates_member_idx
  on public.member_labor_rates (organization_member_id, valid_from desc);
create index member_labor_rates_org_idx on public.member_labor_rates (organization_id);

create trigger member_labor_rates_set_updated_at
  before update on public.member_labor_rates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integridad: el miembro pertenece a la organización, y las vigencias de un
-- mismo miembro no se superponen. El chequeo de superposición toma el lock de
-- la fila del miembro, así que dos altas concurrentes para la misma persona se
-- serializan y la segunda ve lo que commiteó la primera.
-- ---------------------------------------------------------------------------
create or replace function public.check_member_labor_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_org uuid;
  clash record;
begin
  select organization_id into member_org
  from public.organization_members where id = new.organization_member_id for update;

  if member_org is null or member_org <> new.organization_id then
    raise exception 'organization_member_id no pertenece a organization_id';
  end if;

  select r.valid_from, r.valid_to into clash
  from public.member_labor_rates r
  where r.organization_member_id = new.organization_member_id
    and r.id <> new.id
    and daterange(r.valid_from, r.valid_to, '[]') && daterange(new.valid_from, new.valid_to, '[]')
  limit 1;

  if found then
    raise exception 'tarifa_superpuesta: la vigencia se superpone con otra tarifa del mismo miembro (% a %)',
      clash.valid_from, coalesce(clash.valid_to::text, 'abierta');
  end if;

  return new;
end;
$$;

create trigger member_labor_rates_check
  before insert or update on public.member_labor_rates
  for each row execute function public.check_member_labor_rate();

-- ---------------------------------------------------------------------------
-- Resolución de tarifa vigente para un miembro en una fecha (uso interno de los
-- triggers/RPC; no se expone a la API).
-- ---------------------------------------------------------------------------
create or replace function public.resolve_labor_rate(p_member_id uuid, p_date date)
returns table (rate_id uuid, hourly_cost numeric)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.hourly_cost
  from public.member_labor_rates r
  where r.organization_member_id = p_member_id
    and r.valid_from <= p_date
    and (r.valid_to is null or r.valid_to >= p_date)
  limit 1;
$$;

revoke all on function public.resolve_labor_rate(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- set_member_labor_rate: alta de una tarifa nueva desde una fecha.
--   * Si hay una tarifa abierta que empezó antes, se cierra el día anterior.
--   * Si ya existe una tarifa posterior, la nueva se cierra el día anterior a esa.
--   * Si la fecha cae dentro de un período ya cerrado, se rechaza (no se parte
--     un período histórico en silencio).
-- ---------------------------------------------------------------------------
create or replace function public.set_member_labor_rate(
  p_member_id uuid,
  p_hourly_cost numeric,
  p_valid_from date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_covering record;
  v_next_from date;
  v_valid_to date;
  v_id uuid;
begin
  select organization_id into v_org
  from public.organization_members where id = p_member_id for update;

  if v_org is null then
    raise exception 'miembro no encontrado';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'not authorized';
  end if;

  if p_hourly_cost is null or p_hourly_cost < 0 then
    raise exception 'el costo hora debe ser mayor o igual a 0';
  end if;

  if p_valid_from is null then
    raise exception 'la fecha de vigencia es obligatoria';
  end if;

  if exists (
    select 1 from public.member_labor_rates
    where organization_member_id = p_member_id and valid_from = p_valid_from
  ) then
    raise exception 'tarifa_superpuesta: ya existe una tarifa que empieza en esa fecha';
  end if;

  select id, valid_from, valid_to into v_covering
  from public.member_labor_rates
  where organization_member_id = p_member_id
    and valid_from < p_valid_from
    and (valid_to is null or valid_to >= p_valid_from);

  if found then
    if v_covering.valid_to is not null then
      raise exception 'tarifa_superpuesta: la fecha cae dentro de una tarifa ya cerrada (% a %)',
        v_covering.valid_from, v_covering.valid_to;
    end if;
    update public.member_labor_rates set valid_to = p_valid_from - 1 where id = v_covering.id;
  end if;

  select min(valid_from) into v_next_from
  from public.member_labor_rates
  where organization_member_id = p_member_id and valid_from > p_valid_from;

  v_valid_to := case when v_next_from is null then null else v_next_from - 1 end;

  insert into public.member_labor_rates (
    organization_id, organization_member_id, hourly_cost, valid_from, valid_to, notes, created_by
  )
  values (v_org, p_member_id, p_hourly_cost, p_valid_from, v_valid_to, nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.set_member_labor_rate(uuid, numeric, date, text) from public, anon;
grant execute on function public.set_member_labor_rate(uuid, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: solo owner/admin. Worker y viewer no ven costos hora internos.
-- ---------------------------------------------------------------------------
alter table public.member_labor_rates enable row level security;

create policy member_labor_rates_select on public.member_labor_rates
  for select to authenticated
  using (public.is_org_admin(organization_id));
