-- Fase 0-1: Row Level Security en toda tabla de negocio.
--
-- Helpers SECURITY DEFINER: evitan policies recursivas sobre
-- organization_members (la función bypassea RLS internamente, la policy que
-- la usa no vuelve a evaluar RLS sobre esa misma tabla).
--
-- Niveles de acceso:
--   is_org_member   -> cualquier miembro activo (incluye viewer): solo lectura
--   is_org_operator -> owner/admin/worker: opera clientes/trabajos/sesiones
--   is_org_admin    -> owner/admin: administra configuración y miembros

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.active = true
  );
$$;

create or replace function public.is_org_operator(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'worker')
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.shares_organization_with(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m1
    join public.organization_members m2 on m2.organization_id = m1.organization_id
    where m1.user_id = auth.uid()
      and m2.user_id = target_user_id
      and m1.active = true
      and m2.active = true
  );
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_operator(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.shares_organization_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;

create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- No hay policy de insert/delete: el alta ocurre únicamente vía la función
-- bootstrap_organization (SECURITY DEFINER), que bypassea RLS.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_organization_with(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
alter table public.organization_members enable row level security;

create policy organization_members_select on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy organization_members_insert on public.organization_members
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy organization_members_update on public.organization_members
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy organization_members_delete on public.organization_members
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;

create policy clients_select on public.clients
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy clients_update on public.clients
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- client_addresses
-- ---------------------------------------------------------------------------
alter table public.client_addresses enable row level security;

create policy client_addresses_select on public.client_addresses
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy client_addresses_insert on public.client_addresses
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy client_addresses_update on public.client_addresses
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

create policy client_addresses_delete on public.client_addresses
  for delete to authenticated
  using (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- job_types
-- ---------------------------------------------------------------------------
alter table public.job_types enable row level security;

create policy job_types_select on public.job_types
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy job_types_insert on public.job_types
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy job_types_update on public.job_types
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy job_types_delete on public.job_types
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- job_statuses
-- ---------------------------------------------------------------------------
alter table public.job_statuses enable row level security;

create policy job_statuses_select on public.job_statuses
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy job_statuses_insert on public.job_statuses
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy job_statuses_update on public.job_statuses
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy job_statuses_delete on public.job_statuses
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
alter table public.jobs enable row level security;

create policy jobs_select on public.jobs
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy jobs_update on public.jobs
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- job_sessions
-- ---------------------------------------------------------------------------
alter table public.job_sessions enable row level security;

create policy job_sessions_select on public.job_sessions
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy job_sessions_insert on public.job_sessions
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy job_sessions_update on public.job_sessions
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

create policy job_sessions_delete on public.job_sessions
  for delete to authenticated
  using (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- job_status_history (solo lectura para la app; la escritura es del trigger)
-- ---------------------------------------------------------------------------
alter table public.job_status_history enable row level security;

create policy job_status_history_select on public.job_status_history
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- business_hours
-- ---------------------------------------------------------------------------
alter table public.business_hours enable row level security;

create policy business_hours_select on public.business_hours
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy business_hours_update on public.business_hours
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy business_hours_insert on public.business_hours
  for insert to authenticated
  with check (public.is_org_admin(organization_id));
