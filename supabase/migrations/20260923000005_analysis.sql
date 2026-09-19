-- Fase 5: análisis descriptivo de calidad de estimación y carga real.
--
-- Todo es agregación ponderada (no se promedian porcentajes por trabajo):
--   desvío % = (SUM(real) - SUM(estimado)) / SUM(estimado)
-- Solo trabajos CERRADOS (job_statuses.is_closed) y con datos suficientes.
-- jobs_count siempre acompaña a cada métrica (tamaño de muestra).

-- Tiempo: trabajos cerrados con estimación, con al menos una sesión con tiempo real
-- y sin sesiones completadas sin tiempo (datos completos). Sin costos: lo ven
-- todos los miembros de la organización.
create view public.job_type_time_performance
with (security_invoker = true) as
with facts as (
  select
    j.organization_id,
    j.id as job_id,
    j.job_type_id,
    j.estimated_minutes,
    coalesce(sum(extract(epoch from (s.actual_end_at - s.actual_start_at)) / 60)
      filter (where s.actual_start_at is not null and s.actual_end_at is not null), 0) as actual_minutes,
    count(*) filter (
      where s.status = 'completed' and (s.actual_start_at is null or s.actual_end_at is null)
    ) as completed_without_time
  from public.jobs j
  join public.job_statuses st on st.id = j.status_id and st.is_closed
  left join public.job_sessions s on s.job_id = j.id and s.status <> 'cancelled'
  group by j.organization_id, j.id, j.job_type_id, j.estimated_minutes
)
select
  organization_id,
  job_type_id,
  count(*) as closed_jobs_count,
  count(*) filter (where estimated_minutes > 0 and completed_without_time = 0 and actual_minutes > 0) as jobs_count,
  coalesce(sum(estimated_minutes) filter (
    where estimated_minutes > 0 and completed_without_time = 0 and actual_minutes > 0
  ), 0) as estimated_minutes_total,
  coalesce(sum(actual_minutes) filter (
    where estimated_minutes > 0 and completed_without_time = 0 and actual_minutes > 0
  ), 0) as actual_minutes_total
from facts
group by organization_id, job_type_id;

-- Materiales: trabajos cerrados con cotización aceptada (costo estimado) y costo
-- real completo. Es información de costos: solo owner/admin.
create view public.job_type_material_performance
with (security_invoker = true) as
select
  j.organization_id,
  j.job_type_id,
  count(*) as jobs_count,
  sum(cs.estimated_material_cost) as estimated_material_cost_total,
  sum(cs.actual_material_cost) as actual_material_cost_total
from public.jobs j
join public.job_statuses st on st.id = j.status_id and st.is_closed
join public.job_cost_status cs on cs.job_id = j.id
where cs.estimated_material_cost is not null
  and cs.material_cost_complete
  and public.is_org_admin(j.organization_id)
group by j.organization_id, j.job_type_id;

-- Contribución por tipo: solo trabajos cerrados con contribución calculable.
-- Siempre "antes de costos indirectos e impuestos". Solo owner/admin.
create view public.job_type_contribution
with (security_invoker = true) as
select
  e.organization_id,
  j.job_type_id,
  count(*) as jobs_count,
  sum(e.contracted_amount) as contracted_total,
  sum(e.actual_direct_cost) as direct_cost_total,
  sum(e.contribution_amount) as contribution_total
from public.job_economics_status e
join public.jobs j on j.id = e.job_id
where e.job_is_closed and e.contribution_amount is not null
group by e.organization_id, j.job_type_id;

-- ---------------------------------------------------------------------------
-- Carga real por día de la semana.
--   * día = fecha LOCAL (zona de la organización) del inicio real de la sesión
--   * promedio = horas reales de ese día de la semana / cantidad de ese día de la
--     semana en el período (un lunes sin trabajo cuenta como 0, no se excluye)
--   * weekday: 0 = domingo ... 6 = sábado (igual que business_hours)
-- SECURITY INVOKER: el RLS de job_sessions/organizations aplica al que consulta.
-- ---------------------------------------------------------------------------
create or replace function public.weekday_workload(
  p_organization_id uuid,
  p_from date,
  p_to date
)
returns table (
  weekday integer,
  total_minutes numeric,
  days_in_period integer,
  average_minutes numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with tz as (
    select timezone from public.organizations where id = p_organization_id
  ),
  days as (
    select extract(dow from d)::integer as weekday, count(*)::integer as days_in_period
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
    group by 1
  ),
  sess as (
    select
      extract(dow from (s.actual_start_at at time zone tz.timezone))::integer as weekday,
      sum(extract(epoch from (s.actual_end_at - s.actual_start_at)) / 60) as minutes
    from public.job_sessions s
    cross join tz
    where s.organization_id = p_organization_id
      and s.status <> 'cancelled'
      and s.actual_start_at is not null
      and s.actual_end_at is not null
      and (s.actual_start_at at time zone tz.timezone)::date between p_from and p_to
    group by 1
  )
  select
    d.weekday,
    coalesce(s.minutes, 0),
    d.days_in_period,
    coalesce(s.minutes, 0) / d.days_in_period
  from days d
  left join sess s on s.weekday = d.weekday
  order by d.weekday;
$$;

revoke all on function public.weekday_workload(uuid, date, date) from public, anon;
grant execute on function public.weekday_workload(uuid, date, date) to authenticated;
