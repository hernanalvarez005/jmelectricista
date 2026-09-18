-- Fase 2: unidades de medida semilla para organizaciones nuevas Y
-- existentes (la organización de la Fase 0-1 ya existe y no debe quedar
-- sin unidades utilizables).

-- Backfill para organizaciones ya creadas antes de esta migración.
insert into public.material_units (organization_id, name, symbol)
select o.id, u.name, u.symbol
from public.organizations o
cross join (
  values
    ('Unidad', 'u'),
    ('Metro', 'm'),
    ('Rollo', 'rollo'),
    ('Caja', 'caja'),
    ('Kilogramo', 'kg'),
    ('Litro', 'l')
) as u(name, symbol)
on conflict (organization_id, name) do nothing;

-- Redefine bootstrap_organization para que las organizaciones nuevas
-- reciban las mismas unidades semilla desde el alta.
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

  insert into public.material_units (organization_id, name, symbol)
  values
    (new_org_id, 'Unidad', 'u'),
    (new_org_id, 'Metro', 'm'),
    (new_org_id, 'Rollo', 'rollo'),
    (new_org_id, 'Caja', 'caja'),
    (new_org_id, 'Kilogramo', 'kg'),
    (new_org_id, 'Litro', 'l');

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
