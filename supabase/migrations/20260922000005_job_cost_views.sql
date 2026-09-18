-- Fase 4: costo real de materiales por trabajo, siempre desde los costos
-- CONGELADOS en los movimientos (nunca precios actuales de proveedor).
--
--   actual_material_cost = SUM(total_cost de consumos) - SUM(total_cost de devoluciones)
--   estimated_material_cost = SUM(cantidad * cost_unit_price) de los ítems de tipo
--       material de la cotización aceptada (costo estimado al presupuestar)
--
-- material_cost_complete = false si algún consumo/devolución del trabajo no tiene
-- costo (stock histórico sin valoración): en ese caso la UI muestra "costo real
-- incompleto" y no presenta un número parcial como si fuera completo.
-- Todavía NO incluye mano de obra ni otros costos: no es rentabilidad.
create view public.job_material_costs
with (security_invoker = true) as
select
  sm.organization_id,
  sm.job_id,
  sm.material_id,
  coalesce(sum(case sm.movement_type when 'consumption' then sm.total_cost when 'return' then -sm.total_cost end), 0) as net_cost,
  coalesce(sum(case sm.movement_type when 'consumption' then sm.quantity when 'return' then -sm.quantity end), 0) as net_quantity,
  coalesce(bool_and(sm.total_cost is not null), true) as cost_complete
from public.stock_movements sm
where sm.job_id is not null and sm.movement_type in ('consumption', 'return')
group by sm.organization_id, sm.job_id, sm.material_id;

create view public.job_cost_status
with (security_invoker = true) as
select
  j.organization_id,
  j.id as job_id,
  est.estimated_material_cost,
  coalesce(act.actual_material_cost, 0) as actual_material_cost,
  coalesce(act.material_cost_complete, true) as material_cost_complete,
  case
    when est.estimated_material_cost is not null and coalesce(act.material_cost_complete, true)
      then coalesce(act.actual_material_cost, 0) - est.estimated_material_cost
  end as material_cost_variance,
  fin.contracted_amount,
  fin.collected_amount,
  fin.outstanding_amount
from public.jobs j
left join public.quotes aq on aq.job_id = j.id and aq.status = 'accepted'
left join lateral (
  select coalesce(sum(qi.quantity * coalesce(qi.cost_unit_price, 0)), 0) as estimated_material_cost
  from public.quote_items qi
  where qi.quote_id = aq.id and qi.item_type = 'material'
) est on aq.id is not null
left join lateral (
  select
    sum(case sm.movement_type when 'consumption' then sm.total_cost when 'return' then -sm.total_cost end) as actual_material_cost,
    bool_and(sm.total_cost is not null) as material_cost_complete
  from public.stock_movements sm
  where sm.job_id = j.id and sm.movement_type in ('consumption', 'return')
) act on true
left join public.job_financial_status fin on fin.job_id = j.id;

-- Última compra RECIBIDA por material (costo real de compra; no es el precio
-- consultado a un proveedor).
create view public.material_latest_purchases
with (security_invoker = true) as
select distinct on (pi.material_id)
  pi.organization_id,
  pi.material_id,
  pi.unit_cost,
  p.purchase_date,
  p.purchase_number,
  p.supplier_id
from public.purchase_items pi
join public.purchases p on p.id = pi.purchase_id and p.status = 'received'
order by pi.material_id, p.purchase_date desc, p.received_at desc;
