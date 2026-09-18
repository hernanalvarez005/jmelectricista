-- Fase 3: RLS de medios de pago, cuentas y cobros + Storage de comprobantes.

-- ---------------------------------------------------------------------------
-- payment_methods (catálogo de configuración: mismo criterio que job_types/
-- job_statuses/business_hours -> solo admin/owner puede escribir)
-- ---------------------------------------------------------------------------
alter table public.payment_methods enable row level security;

create policy payment_methods_select on public.payment_methods
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy payment_methods_insert on public.payment_methods
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy payment_methods_update on public.payment_methods
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy payment_methods_delete on public.payment_methods
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- payment_accounts
-- ---------------------------------------------------------------------------
alter table public.payment_accounts enable row level security;

create policy payment_accounts_select on public.payment_accounts
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy payment_accounts_insert on public.payment_accounts
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy payment_accounts_update on public.payment_accounts
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy payment_accounts_delete on public.payment_accounts
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- job_payments: solo lectura vía RLS. El alta pasa siempre por
-- register_job_payment (numeración/idempotencia atómica) y la anulación por
-- void_job_payment (auditoría obligatoria) — ambas SECURITY DEFINER, así que
-- no hace falta (ni conviene) una policy de insert/update directa.
-- ---------------------------------------------------------------------------
alter table public.job_payments enable row level security;

create policy job_payments_select on public.job_payments
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para comprobantes de cobro.
-- Path: organizations/{organization_id}/jobs/{job_id}/payments/{payment_id}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

create policy payment_receipts_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_member(((storage.foldername(name))[2])::uuid)
  );

create policy payment_receipts_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_operator(((storage.foldername(name))[2])::uuid)
  );
