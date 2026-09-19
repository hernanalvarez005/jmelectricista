-- Fase 5: costo laboral por trabajo, gastos directos, costo directo y contribución.
--
-- Fuentes de verdad (no se duplican fórmulas):
--   materiales   -> job_cost_status (costo real congelado por movimiento)
--   contratado   -> job_financial_status (quote aceptada)
--   mano de obra -> sesiones con tiempo real + snapshot de tarifa (job_session_labor_costs)
--   gastos       -> job_expenses no anulados
--
-- Estas vistas exponen costos internos y contribución: solo las ven owner/admin
-- (la condición está en la vista misma; ocultar una ruta en la UI no alcanza).
--
-- Contribución = monto contratado - costo directo, ANTES de costos indirectos e
-- impuestos. No es utilidad ni rentabilidad neta.

create view public.job_labor_costs
with (security_invoker = true) as
with session_facts as (
  select
    s.organization_id,
    s.job_id,
    (s.status <> 'cancelled'
      and (s.status = 'completed' or (s.actual_start_at is not null and s.actual_end_at is not null))) as relevant,
    (s.actual_start_at is not null and s.actual_end_at is not null) as has_time,
    case
      when s.actual_start_at is not null and s.actual_end_at is not null
        then extract(epoch from (s.actual_end_at - s.actual_start_at)) / 60
    end as minutes,
    s.assigned_member_id,
    c.hourly_cost_snapshot
  from public.job_sessions s
  left join public.job_session_labor_costs c on c.job_session_id = s.id
)
select
  j.organization_id,
  j.id as job_id,
  count(*) filter (where f.relevant) as labor_sessions_count,
  coalesce(sum(f.minutes) filter (where f.relevant and f.has_time), 0) as actual_minutes,
  coalesce(
    round(sum(f.minutes / 60 * f.hourly_cost_snapshot)
      filter (where f.relevant and f.has_time and f.hourly_cost_snapshot is not null), 2),
    0
  ) as actual_labor_cost,
  count(*) filter (where f.relevant and not f.has_time) as sessions_missing_time,
  count(*) filter (where f.relevant and f.has_time and f.assigned_member_id is null) as sessions_missing_member,
  count(*) filter (
    where f.relevant and f.has_time and f.assigned_member_id is not null and f.hourly_cost_snapshot is null
  ) as sessions_missing_rate,
  (
    count(*) filter (where f.relevant and not f.has_time) = 0
    and count(*) filter (where f.relevant and f.has_time and f.assigned_member_id is null) = 0
    and count(*) filter (
      where f.relevant and f.has_time and f.assigned_member_id is not null and f.hourly_cost_snapshot is null
    ) = 0
  ) as labor_cost_complete
from public.jobs j
left join session_facts f on f.job_id = j.id
where public.is_org_admin(j.organization_id)
group by j.organization_id, j.id;

create view public.job_economics_status
with (security_invoker = true) as
-- Cada fuente se evalúa una sola vez (MATERIALIZED) y se une por job_id. Con RLS, los
-- filtros opacos (is_org_member/is_org_admin) hacen que el planner estime ~1 fila y elija
-- nested loops que reevalúan las vistas compuestas una vez por trabajo (cuadrático).
with fin as materialized (
  select * from public.job_financial_status
),
cs as materialized (
  select * from public.job_cost_status
),
lab as materialized (
  select * from public.job_labor_costs
),
exp as materialized (
  select
    e.job_id,
    sum(e.amount) as direct_expense_total,
    count(*) as direct_expense_count
  from public.job_expenses e
  where e.voided_at is null
  group by e.job_id
)
select
  j.organization_id,
  j.id as job_id,
  st.is_closed as job_is_closed,

  fin.contracted_amount,
  fin.collected_amount,
  fin.outstanding_amount,

  cs.estimated_material_cost,
  cs.actual_material_cost,
  cs.material_cost_complete,

  lab.actual_minutes,
  lab.actual_labor_cost,
  lab.labor_cost_complete,
  lab.labor_sessions_count,
  lab.sessions_missing_time,
  lab.sessions_missing_member,
  lab.sessions_missing_rate,

  coalesce(exp.direct_expense_total, 0) as direct_expense_total,
  coalesce(exp.direct_expense_count, 0) as direct_expense_count,

  -- Suma de lo registrado hasta ahora (parcial si hay datos incompletos).
  cs.actual_material_cost + lab.actual_labor_cost + coalesce(exp.direct_expense_total, 0) as recorded_direct_cost,

  (cs.material_cost_complete and lab.labor_cost_complete) as direct_cost_data_complete,

  case
    when cs.material_cost_complete and lab.labor_cost_complete
      then cs.actual_material_cost + lab.actual_labor_cost + coalesce(exp.direct_expense_total, 0)
  end as actual_direct_cost,

  case
    when fin.contracted_amount is not null and cs.material_cost_complete and lab.labor_cost_complete
      then fin.contracted_amount
           - (cs.actual_material_cost + lab.actual_labor_cost + coalesce(exp.direct_expense_total, 0))
  end as contribution_amount,

  case
    when fin.contracted_amount > 0 and cs.material_cost_complete and lab.labor_cost_complete
      then (fin.contracted_amount
            - (cs.actual_material_cost + lab.actual_labor_cost + coalesce(exp.direct_expense_total, 0)))
           / fin.contracted_amount * 100
  end as contribution_percentage
from public.jobs j
join public.job_statuses st on st.id = j.status_id
join fin on fin.job_id = j.id
join cs on cs.job_id = j.id
join lab on lab.job_id = j.id
left join exp on exp.job_id = j.id
where public.is_org_admin(j.organization_id);
