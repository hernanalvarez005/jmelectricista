-- Fase 5.1: enlaces públicos, seguros y revocables para compartir UNA cotización por WhatsApp.
--
-- El token es la única credencial de la página pública /cotizacion/[token]. Autoriza
-- exclusivamente la cotización asociada: la resolución pública pasa por get_public_quote,
-- que devuelve un DTO explícito (jamás la fila de quotes ni datos económicos internos).
-- El bucket de PDFs sigue privado: el PDF público se renderiza desde ese mismo DTO.

create table public.quote_share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  token text not null unique check (length(token) >= 40),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0 check (open_count >= 0),
  constraint quote_share_links_revocation_consistent check (
    (active and revoked_at is null) or (not active and revoked_at is not null)
  )
);

-- Como máximo un enlace ACTIVO por cotización (los revocados quedan como historial).
create unique index quote_share_links_one_active_uidx on public.quote_share_links (quote_id) where active;
create index quote_share_links_quote_idx on public.quote_share_links (quote_id, active);
create index quote_share_links_org_idx on public.quote_share_links (organization_id);

create or replace function public.check_quote_share_link_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.quotes where id = new.quote_id;
  if v_org is null or v_org <> new.organization_id then
    raise exception 'quote_id no pertenece a organization_id';
  end if;
  return new;
end;
$$;

create trigger quote_share_links_check_org
  before insert on public.quote_share_links
  for each row execute function public.check_quote_share_link_org();

-- Token: ~180 bits de un generador criptográfico (dos UUID v4), sin nada derivado del
-- número de cotización ni de ids visibles.
create or replace function public.generate_share_token()
returns text
language sql
volatile
as $$
  select substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 48);
$$;

revoke all on function public.generate_share_token() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Obtener o crear el enlace activo (idempotente y seguro bajo concurrencia).
-- Solo cotizaciones ya enviadas (no borradores) pueden compartirse.
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_quote_share_link(p_quote_id uuid)
returns public.quote_share_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_status text;
  v_link public.quote_share_links;
begin
  select organization_id, status into v_org, v_status from public.quotes where id = p_quote_id;
  if v_org is null then
    raise exception 'cotización no encontrada';
  end if;

  if not public.is_org_operator(v_org) then
    raise exception 'not authorized';
  end if;

  if v_status = 'draft' then
    raise exception 'cotizacion_borrador: marcá la cotización como enviada antes de compartirla';
  end if;

  select * into v_link from public.quote_share_links where quote_id = p_quote_id and active;
  if found then
    return v_link;
  end if;

  insert into public.quote_share_links (organization_id, quote_id, token, created_by)
  values (v_org, p_quote_id, public.generate_share_token(), auth.uid())
  on conflict (quote_id) where active do nothing
  returning * into v_link;

  if v_link.id is null then
    -- Otro request creó el enlace activo entre el select y el insert.
    select * into v_link from public.quote_share_links where quote_id = p_quote_id and active;
  end if;

  return v_link;
end;
$$;

revoke all on function public.get_or_create_quote_share_link(uuid) from public, anon;
grant execute on function public.get_or_create_quote_share_link(uuid) to authenticated;

-- Revocación inmediata: el token deja de resolver en el mismo instante.
create or replace function public.revoke_quote_share_link(p_quote_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_updated integer;
begin
  select organization_id into v_org from public.quotes where id = p_quote_id;
  if v_org is null then
    raise exception 'cotización no encontrada';
  end if;

  if not public.is_org_operator(v_org) then
    raise exception 'not authorized';
  end if;

  update public.quote_share_links
  set active = false, revoked_at = now()
  where quote_id = p_quote_id and active;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.revoke_quote_share_link(uuid) from public, anon;
grant execute on function public.revoke_quote_share_link(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Resolución pública por token. Devuelve un DTO EXPLÍCITO con datos comerciales para el
-- cliente (lo mismo que ya muestra el PDF). Nunca costos, márgenes, compras, mano de obra,
-- gastos, contribución, stock, notas internas ni ids internos.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_quote(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 40 then
    return null;
  end if;

  select l.quote_id into v_quote_id
  from public.quote_share_links l
  join public.quotes q on q.id = l.quote_id
  where l.token = p_token and l.active and q.status <> 'draft';

  if v_quote_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'organization_name', o.name,
    'currency', o.currency,
    'quote_number', q.quote_number,
    'issue_date', q.issue_date,
    'valid_until', q.valid_until,
    'client_name', c.name,
    'client_address', nullif(concat_ws(', ', a.label, a.street, a.locality, a.province), ''),
    'job_title', j.title,
    'job_description', j.description,
    'subtotal', q.subtotal,
    'discount_amount', q.discount_amount,
    'total', q.total,
    'terms', q.terms,
    'notes', q.notes,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'description', qi.description,
          'quantity', qi.quantity,
          'unit', qi.unit,
          'unit_price', qi.sale_unit_price,
          'subtotal', round(qi.quantity * qi.sale_unit_price, 2)
        )
        order by qi.sort_order, qi.created_at
      )
      from public.quote_items qi
      where qi.quote_id = q.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.quotes q
  join public.organizations o on o.id = q.organization_id
  join public.clients c on c.id = q.client_id
  join public.jobs j on j.id = q.job_id
  left join public.client_addresses a on a.id = j.client_address_id
  where q.id = v_quote_id;

  return v_result;
end;
$$;

revoke all on function public.get_public_quote(text) from public;
grant execute on function public.get_public_quote(text) to anon, authenticated;

-- Tracking mínimo y atómico (sin IP ni user agent): contador + última apertura.
create or replace function public.record_quote_share_open(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_token is null or length(p_token) < 40 then
    return false;
  end if;

  update public.quote_share_links l
  set open_count = l.open_count + 1, last_opened_at = now()
  from public.quotes q
  where q.id = l.quote_id and l.token = p_token and l.active and q.status <> 'draft';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.record_quote_share_open(text) from public;
grant execute on function public.record_quote_share_open(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: anon no lee ni lista nada. Los usuarios internos (owner/admin/worker) ven los
-- enlaces de su organización; toda escritura pasa por los RPC anteriores.
-- ---------------------------------------------------------------------------
alter table public.quote_share_links enable row level security;

create policy quote_share_links_select on public.quote_share_links
  for select to authenticated
  using (public.is_org_operator(organization_id));

-- Defensa en profundidad: aunque RLS ya deniega a anon, se le quitan los grants de tabla.
-- El acceso público pasa únicamente por get_public_quote / record_quote_share_open (SECURITY DEFINER).
revoke all on table public.quote_share_links from anon;
