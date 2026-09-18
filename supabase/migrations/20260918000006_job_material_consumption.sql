-- Fase 2: registrar consumo real de un material en un trabajo de forma
-- idempotente. Guardar solo el delta contra el consumo previo evita el
-- doble descuento si el usuario reenvía el mismo formulario (dos envíos
-- con el mismo actual_quantity generan delta = 0, sin movimiento nuevo).
-- El row lock (for update) también lo hace seguro ante dos envíos
-- concurrentes del mismo job_material.
create or replace function public.register_job_material_consumption(
  p_job_material_id uuid,
  p_actual_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_material uuid;
  v_job uuid;
  v_previous numeric;
  v_delta numeric;
begin
  if p_actual_quantity < 0 then
    raise exception 'actual_quantity debe ser >= 0';
  end if;

  select organization_id, material_id, job_id, coalesce(actual_quantity, 0)
  into v_org, v_material, v_job, v_previous
  from public.job_materials
  where id = p_job_material_id
  for update;

  if v_org is null then
    raise exception 'job_material no encontrado';
  end if;

  if not public.is_org_operator(v_org) then
    raise exception 'not authorized';
  end if;

  v_delta := p_actual_quantity - v_previous;

  if v_delta > 0 then
    insert into public.stock_movements (organization_id, material_id, job_id, movement_type, quantity, created_by)
    values (v_org, v_material, v_job, 'consumption', v_delta, auth.uid());
  elsif v_delta < 0 then
    insert into public.stock_movements (organization_id, material_id, job_id, movement_type, quantity, created_by)
    values (v_org, v_material, v_job, 'return', -v_delta, auth.uid());
  end if;

  update public.job_materials set actual_quantity = p_actual_quantity where id = p_job_material_id;
end;
$$;

revoke all on function public.register_job_material_consumption(uuid, numeric) from public;
grant execute on function public.register_job_material_consumption(uuid, numeric) to authenticated;
