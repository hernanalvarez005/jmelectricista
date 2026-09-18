-- Fase 2: cotizaciones, numeración atómica y totales recalculados en servidor.

create table public.quote_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  next_number integer not null default 1
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  quote_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  issue_date date not null default current_date,
  valid_until date,
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  notes text,
  terms text,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_number),
  constraint quotes_sent_timestamp check (status not in ('sent', 'accepted', 'rejected') or sent_at is not null),
  constraint quotes_accepted_timestamp check (status <> 'accepted' or accepted_at is not null),
  constraint quotes_rejected_timestamp check (status <> 'rejected' or rejected_at is not null)
);

create index quotes_org_idx on public.quotes (organization_id);
create index quotes_job_idx on public.quotes (job_id);
create index quotes_client_idx on public.quotes (client_id);
create index quotes_status_idx on public.quotes (status);

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- job_id y client_id deben pertenecer a organization_id, y el cliente debe
-- ser el cliente del propio trabajo (evita cotizar el trabajo de un cliente
-- a nombre de otro).
create or replace function public.check_quote_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_org uuid;
  job_client uuid;
  client_org uuid;
begin
  select organization_id, client_id into job_org, job_client from public.jobs where id = new.job_id;
  if job_org is null or job_org <> new.organization_id then
    raise exception 'job_id no pertenece a organization_id';
  end if;
  if job_client is distinct from new.client_id then
    raise exception 'client_id no coincide con el cliente del trabajo';
  end if;

  select organization_id into client_org from public.clients where id = new.client_id;
  if client_org is null or client_org <> new.organization_id then
    raise exception 'client_id no pertenece a organization_id';
  end if;

  return new;
end;
$$;

create trigger quotes_check_org_consistency
  before insert or update on public.quotes
  for each row execute function public.check_quote_org_consistency();

-- Máquina de estados server-side: valida transiciones y estampa los
-- timestamps correspondientes (nunca confiar en que el cliente los mande
-- coherentes), y bloquea la edición de una cotización que ya salió de
-- borrador (salvo el propio cambio de estado).
create or replace function public.guard_quote_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'sent' then
      new.sent_at := now();
    elsif old.status = 'sent' and new.status = 'accepted' then
      new.accepted_at := now();
    elsif old.status = 'sent' and new.status = 'rejected' then
      new.rejected_at := now();
    elsif old.status = 'sent' and new.status = 'expired' then
      null;
    else
      raise exception 'transición de estado de cotización inválida: % -> %', old.status, new.status;
    end if;
    return new;
  end if;

  if old.status <> 'draft' then
    if new.notes is distinct from old.notes
      or new.terms is distinct from old.terms
      or new.discount_amount is distinct from old.discount_amount
      or new.valid_until is distinct from old.valid_until
      or new.issue_date is distinct from old.issue_date
      or new.job_id is distinct from old.job_id
      or new.client_id is distinct from old.client_id
      or new.quote_number is distinct from old.quote_number
    then
      raise exception 'la cotización ya no está en borrador: no se puede editar';
    end if;
  end if;

  return new;
end;
$$;

create trigger quotes_guard_mutation
  before update on public.quotes
  for each row execute function public.guard_quote_mutation();

-- ---------------------------------------------------------------------------
-- quote_items
-- ---------------------------------------------------------------------------
create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  item_type text not null check (item_type in ('material', 'labor', 'service', 'other')),
  material_id uuid references public.materials (id) on delete restrict,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null,
  cost_unit_price numeric(14, 2) check (cost_unit_price is null or cost_unit_price >= 0),
  sale_unit_price numeric(14, 2) not null check (sale_unit_price >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_items_material_type check (item_type <> 'material' or material_id is not null)
);

create index quote_items_org_idx on public.quote_items (organization_id);
create index quote_items_quote_idx on public.quote_items (quote_id, sort_order);
create index quote_items_material_idx on public.quote_items (material_id);

create trigger quote_items_set_updated_at
  before update on public.quote_items
  for each row execute function public.set_updated_at();

-- quote_id y material_id (si existe) deben pertenecer a organization_id, y
-- solo se puede modificar mientras la cotización está en borrador.
create or replace function public.check_quote_item_org_and_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_org uuid;
  quote_status text;
  material_org uuid;
  target_quote_id uuid;
begin
  target_quote_id := coalesce(new.quote_id, old.quote_id);
  select organization_id, status into quote_org, quote_status
  from public.quotes where id = target_quote_id;

  if quote_org is null then
    raise exception 'quote_id inválido';
  end if;

  if tg_op <> 'DELETE' and quote_org <> new.organization_id then
    raise exception 'quote_id no pertenece a organization_id';
  end if;

  if quote_status <> 'draft' then
    raise exception 'la cotización ya no está en borrador: no se pueden modificar sus ítems';
  end if;

  if tg_op <> 'DELETE' and new.material_id is not null then
    select organization_id into material_org from public.materials where id = new.material_id;
    if material_org is null or material_org <> new.organization_id then
      raise exception 'material_id no pertenece a organization_id';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger quote_items_check_org_and_status
  before insert or update or delete on public.quote_items
  for each row execute function public.check_quote_item_org_and_status();

-- Totales recalculados siempre en el servidor: nunca se confía en el monto
-- que mande el navegador.
create or replace function public.recalc_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(14, 2);
  v_discount numeric(14, 2);
begin
  select coalesce(sum(quantity * sale_unit_price), 0)
  into v_subtotal
  from public.quote_items
  where quote_id = p_quote_id;

  select discount_amount into v_discount from public.quotes where id = p_quote_id;

  update public.quotes
  set subtotal = v_subtotal,
      total = greatest(v_subtotal - coalesce(v_discount, 0), 0)
  where id = p_quote_id;
end;
$$;

create or replace function public.quote_items_recalc_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_quote_totals(coalesce(new.quote_id, old.quote_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger quote_items_recalc_totals
  after insert or update or delete on public.quote_items
  for each row execute function public.quote_items_recalc_trigger();

create or replace function public.quote_discount_recalc_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_quote_totals(new.id);
  return new;
end;
$$;

create trigger quotes_recalc_totals_on_discount
  after update of discount_amount on public.quotes
  for each row
  when (old.discount_amount is distinct from new.discount_amount)
  execute function public.quote_discount_recalc_trigger();

-- ---------------------------------------------------------------------------
-- Numeración atómica (COT-000001, ...) + creación de la cotización en una
-- sola transacción. No hay policy de INSERT directa sobre quotes: toda alta
-- pasa por esta función para que la numeración no pueda saltarse ni
-- duplicarse desde el cliente.
-- ---------------------------------------------------------------------------
create or replace function public.create_quote(p_job_id uuid, p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_job_client uuid;
  v_next integer;
  v_number text;
  v_quote_id uuid;
begin
  select organization_id, client_id into v_org_id, v_job_client
  from public.jobs where id = p_job_id;

  if v_org_id is null then
    raise exception 'trabajo no encontrado';
  end if;

  if not public.is_org_operator(v_org_id) then
    raise exception 'not authorized';
  end if;

  if v_job_client is distinct from p_client_id then
    raise exception 'client_id no coincide con el cliente del trabajo';
  end if;

  insert into public.quote_counters (organization_id, next_number)
  values (v_org_id, 2)
  on conflict (organization_id) do update set next_number = quote_counters.next_number + 1
  returning next_number - 1 into v_next;

  v_number := 'COT-' || lpad(v_next::text, 6, '0');

  insert into public.quotes (organization_id, job_id, client_id, quote_number, status, created_by)
  values (v_org_id, p_job_id, p_client_id, v_number, 'draft', auth.uid())
  returning id into v_quote_id;

  return v_quote_id;
end;
$$;

revoke all on function public.create_quote(uuid, uuid) from public;
grant execute on function public.create_quote(uuid, uuid) to authenticated;
