-- Fase 4: RLS de compras y valuación + bucket privado de documentos.

alter table public.purchase_counters enable row level security;  -- sin policies: solo create_purchase

-- purchases: alta solo por create_purchase (numeración + idempotencia); el
-- estado solo cambia por receive_purchase / cancel_purchase (guard trigger).
-- Sin DELETE: una compra cancelada queda como registro.
alter table public.purchases enable row level security;

create policy purchases_select on public.purchases
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy purchases_update on public.purchases
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

alter table public.purchase_items enable row level security;

create policy purchase_items_select on public.purchase_items
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy purchase_items_insert on public.purchase_items
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy purchase_items_update on public.purchase_items
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

create policy purchase_items_delete on public.purchase_items
  for delete to authenticated
  using (public.is_org_operator(organization_id));

-- Valuación: solo lectura para la app. Se escribe únicamente desde el trigger
-- apply_stock_valuation y initialize_material_valuation (SECURITY DEFINER).
alter table public.material_inventory_valuation enable row level security;

create policy material_inventory_valuation_select on public.material_inventory_valuation
  for select to authenticated
  using (public.is_org_member(organization_id));

alter table public.material_valuation_events enable row level security;

create policy material_valuation_events_select on public.material_valuation_events
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Storage: documentos del proveedor (factura/remito).
-- Path: organizations/{organization_id}/purchases/{purchase_id}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('purchase-documents', 'purchase-documents', false)
on conflict (id) do nothing;

create policy purchase_documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'purchase-documents'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_member(((storage.foldername(name))[2])::uuid)
  );

create policy purchase_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'purchase-documents'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_operator(((storage.foldername(name))[2])::uuid)
  );

create policy purchase_documents_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'purchase-documents'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_operator(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'purchase-documents'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_operator(((storage.foldername(name))[2])::uuid)
  );
