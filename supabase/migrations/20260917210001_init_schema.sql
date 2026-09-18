-- Fase 0-1: esquema base multi-organización.
-- Convenciones: PK uuid, organization_id + created_at/updated_at en toda
-- tabla de negocio, minutos (no strings) para duraciones, timestamptz para
-- todo instante de tiempo.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------------
-- Función utilitaria: mantiene updated_at al día en cualquier tabla.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  currency text not null default 'ARS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea automáticamente el profile cuando se crea un usuario en auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'worker', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_org_idx on public.organization_members (organization_id);
create index organization_members_user_idx on public.organization_members (user_id);

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  tax_id text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_org_idx on public.clients (organization_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- client_addresses
-- ---------------------------------------------------------------------------
create table public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  label text,
  street text,
  locality text,
  province text,
  postal_code text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_addresses_org_idx on public.client_addresses (organization_id);
create index client_addresses_client_idx on public.client_addresses (client_id);

create trigger client_addresses_set_updated_at
  before update on public.client_addresses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_types (configurable por organización)
-- ---------------------------------------------------------------------------
create table public.job_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  default_estimated_minutes integer check (default_estimated_minutes is null or default_estimated_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index job_types_org_idx on public.job_types (organization_id);

create trigger job_types_set_updated_at
  before update on public.job_types
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_statuses (configurable por organización, sin enum de Postgres)
-- ---------------------------------------------------------------------------
create table public.job_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null,
  sort_order integer not null default 0,
  is_closed boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index job_statuses_org_idx on public.job_statuses (organization_id);

create trigger job_statuses_set_updated_at
  before update on public.job_statuses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- jobs (entidad central)
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  client_address_id uuid references public.client_addresses (id) on delete set null,
  job_type_id uuid references public.job_types (id) on delete restrict,
  status_id uuid not null references public.job_statuses (id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  target_date date,
  assigned_member_id uuid references public.organization_members (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_org_idx on public.jobs (organization_id);
create index jobs_client_idx on public.jobs (client_id);
create index jobs_status_idx on public.jobs (status_id);
create index jobs_target_date_idx on public.jobs (target_date);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- Un client_address_id, si está presente, debe pertenecer al mismo client_id.
create or replace function public.check_job_client_address()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addr_client_id uuid;
begin
  if new.client_address_id is not null then
    select client_id into addr_client_id
    from public.client_addresses
    where id = new.client_address_id;

    if addr_client_id is null or addr_client_id <> new.client_id then
      raise exception 'client_address_id no pertenece a client_id';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_check_client_address
  before insert or update on public.jobs
  for each row execute function public.check_job_client_address();

-- ---------------------------------------------------------------------------
-- job_sessions (bloques de agenda de un trabajo)
-- ---------------------------------------------------------------------------
create table public.job_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  assigned_member_id uuid references public.organization_members (id) on delete set null,
  planned_start_at timestamptz not null,
  planned_end_at timestamptz not null,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_sessions_planned_range check (planned_end_at > planned_start_at),
  constraint job_sessions_actual_range check (
    actual_start_at is null or actual_end_at is null or actual_end_at > actual_start_at
  )
);

create index job_sessions_org_idx on public.job_sessions (organization_id);
create index job_sessions_job_idx on public.job_sessions (job_id);
create index job_sessions_planned_start_idx on public.job_sessions (planned_start_at);

create trigger job_sessions_set_updated_at
  before update on public.job_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_status_history (trazabilidad, escrita por trigger de servidor)
-- ---------------------------------------------------------------------------
create table public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  from_status_id uuid references public.job_statuses (id) on delete restrict,
  to_status_id uuid not null references public.job_statuses (id) on delete restrict,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index job_status_history_job_idx on public.job_status_history (job_id, changed_at);

create or replace function public.log_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_status_history (organization_id, job_id, from_status_id, to_status_id, changed_by)
    values (new.organization_id, new.id, null, new.status_id, auth.uid());
  elsif tg_op = 'UPDATE' and new.status_id is distinct from old.status_id then
    insert into public.job_status_history (organization_id, job_id, from_status_id, to_status_id, changed_by)
    values (new.organization_id, new.id, old.status_id, new.status_id, auth.uid());
  end if;
  return new;
end;
$$;

create trigger jobs_log_status_change
  after insert or update on public.jobs
  for each row execute function public.log_job_status_change();

-- ---------------------------------------------------------------------------
-- business_hours (configurable, define la capacidad laboral por día)
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6), -- 0 = domingo ... 6 = sábado
  is_working_day boolean not null default true,
  start_time time,
  end_time time,
  break_start time,
  break_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, weekday),
  constraint business_hours_valid_range check (
    (is_working_day = false)
    or (
      start_time is not null
      and end_time is not null
      and end_time > start_time
      and (
        break_start is null
        or (
          break_end is not null
          and break_start >= start_time
          and break_end <= end_time
          and break_end > break_start
        )
      )
    )
  )
);

create index business_hours_org_idx on public.business_hours (organization_id);

create trigger business_hours_set_updated_at
  before update on public.business_hours
  for each row execute function public.set_updated_at();
