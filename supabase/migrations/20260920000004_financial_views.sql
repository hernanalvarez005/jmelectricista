-- Fase 3: fuente única para "contratado / cobrado / pendiente / excedente"
-- de un trabajo, y su agregación por cliente. security_invoker = true para
-- que respeten el RLS del usuario que consulta (mismo patrón que
-- material_stock_balances / job_material_status).
--
-- Fórmulas (ver README):
--   contracted_amount = total de la única quote 'accepted' del job (null si no hay)
--   collected_amount  = SUM(job_payments.amount) WHERE voided_at IS NULL
--   outstanding_amount = NULL si no hay contrato; si no, MAX(contracted - collected, 0)
--   overpaid_amount    = 0 si no hay contrato; si no, MAX(collected - contracted, 0)
--   payment_status: 'no_contract' | 'unpaid' | 'partial' | 'paid'
create view public.job_financial_status
with (security_invoker = true) as
select
  j.organization_id,
  j.id as job_id,
  aq.id as accepted_quote_id,
  aq.total as contracted_amount,
  coalesce(pay.collected_amount, 0) as collected_amount,
  case
    when aq.total is null then null
    else greatest(aq.total - coalesce(pay.collected_amount, 0), 0)
  end as outstanding_amount,
  case
    when aq.total is null then 0
    else greatest(coalesce(pay.collected_amount, 0) - aq.total, 0)
  end as overpaid_amount,
  case
    when aq.total is null then 'no_contract'
    when coalesce(pay.collected_amount, 0) = 0 then 'unpaid'
    when coalesce(pay.collected_amount, 0) >= aq.total then 'paid'
    else 'partial'
  end as payment_status,
  pay.last_payment_date
from public.jobs j
left join public.quotes aq on aq.job_id = j.id and aq.status = 'accepted'
left join lateral (
  select sum(jp.amount) as collected_amount, max(jp.payment_date) as last_payment_date
  from public.job_payments jp
  where jp.job_id = j.id and jp.voided_at is null
) pay on true;

-- Agregación por cliente, para no repetir la suma en cada pantalla (ficha
-- cliente) ni hacer una query por trabajo. uncontracted_collections separa
-- cobros de trabajos sin cotización aceptada, para no mezclarlos
-- silenciosamente con el saldo contratado.
create view public.client_financial_summary
with (security_invoker = true) as
select
  c.organization_id,
  c.id as client_id,
  coalesce(sum(jfs.contracted_amount), 0) as contracted_amount,
  coalesce(sum(jfs.collected_amount), 0) as collected_amount,
  coalesce(sum(jfs.outstanding_amount), 0) as outstanding_amount,
  coalesce(sum(case when jfs.accepted_quote_id is null then jfs.collected_amount else 0 end), 0)
    as uncontracted_collections
from public.clients c
left join public.jobs j on j.client_id = c.id
left join public.job_financial_status jfs on jfs.job_id = j.id
group by c.organization_id, c.id;
