-- Fase 5.1: vistas de facturación (fuente única; no se recalcula en componentes).
--
-- billing_status: 'pending' si no hay fila en job_billing. is_billable distingue trabajos en
-- los que ya tiene sentido facturar (hay una cotización aceptada o algún cobro no anulado, o
-- ya están facturados) de los que recién están en consulta y no deben inflar "pendientes".
create view public.job_billing_status
with (security_invoker = true) as
select
  j.organization_id,
  j.id as job_id,
  coalesce(b.status, 'pending') as billing_status,
  b.invoiced_at,
  b.invoice_number,
  b.notes as billing_notes,
  (
    coalesce(b.status, 'pending') = 'invoiced'
    or exists (select 1 from public.quotes q where q.job_id = j.id and q.status = 'accepted')
    or exists (select 1 from public.job_payments p where p.job_id = j.id and p.voided_at is null)
  ) as is_billable
from public.jobs j
left join public.job_billing b on b.job_id = j.id;

-- Resumen por organización para el dashboard (derivado, nunca guardado a mano).
create view public.billing_pending_summary
with (security_invoker = true) as
with billing as materialized (
  select organization_id, job_id from public.job_billing_status
  where is_billable and billing_status = 'pending'
),
fin as materialized (
  select job_id, payment_status from public.job_financial_status
)
select
  b.organization_id,
  count(*) as billing_pending_count,
  count(*) filter (where f.payment_status = 'paid') as paid_and_billing_pending_count
from billing b
left join fin f on f.job_id = b.job_id
group by b.organization_id;

revoke all on table public.job_billing_status from anon;
revoke all on table public.billing_pending_summary from anon;
