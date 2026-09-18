-- Fase 0-1: bootstrap atómico de una organización nueva para el usuario
-- autenticado (onboarding). SECURITY DEFINER: corre con privilegios propios,
-- bypassea RLS para las inserciones iniciales (no hay policy de INSERT en
-- organizations ni en job_statuses/job_types/business_hours para usuarios
-- comunes; solo esta función puede poblarlas).

create or replace function public.generate_org_slug(base_name text)
returns text
language plpgsql
set search_path = public
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 0;
begin
  base_slug := trim(both '-' from regexp_replace(lower(unaccent(base_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'org';
  end if;

  candidate := base_slug;
  while exists (select 1 from public.organizations where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  return candidate;
end;
$$;

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

revoke all on function public.bootstrap_organization(text) from public;
revoke all on function public.generate_org_slug(text) from public;
grant execute on function public.bootstrap_organization(text) to authenticated;
