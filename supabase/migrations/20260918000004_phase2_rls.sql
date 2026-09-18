-- Fase 2: RLS para materiales, stock, proveedores y cotizaciones.
-- Mismo patrón de la Fase 0-1: is_org_member (lectura), is_org_operator
-- (owner/admin/worker, operan el día a día), sin policy = acceso denegado.

-- ---------------------------------------------------------------------------
-- material_categories
-- ---------------------------------------------------------------------------
alter table public.material_categories enable row level security;

create policy material_categories_select on public.material_categories
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy material_categories_insert on public.material_categories
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy material_categories_update on public.material_categories
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- material_units
-- ---------------------------------------------------------------------------
alter table public.material_units enable row level security;

create policy material_units_select on public.material_units
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy material_units_insert on public.material_units
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy material_units_update on public.material_units
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- materials
-- ---------------------------------------------------------------------------
alter table public.materials enable row level security;

create policy materials_select on public.materials
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy materials_insert on public.materials
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy materials_update on public.materials
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- stock_movements: solo lectura + alta. Append-only, sin update ni delete
-- (la trazabilidad de stock no debe poder reescribirse).
-- ---------------------------------------------------------------------------
alter table public.stock_movements enable row level security;

create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- job_materials
-- ---------------------------------------------------------------------------
alter table public.job_materials enable row level security;

create policy job_materials_select on public.job_materials
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy job_materials_insert on public.job_materials
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy job_materials_update on public.job_materials
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

create policy job_materials_delete on public.job_materials
  for delete to authenticated
  using (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
alter table public.suppliers enable row level security;

create policy suppliers_select on public.suppliers
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy suppliers_insert on public.suppliers
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy suppliers_update on public.suppliers
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- supplier_material_prices: historial inmutable, solo lectura + alta.
-- ---------------------------------------------------------------------------
alter table public.supplier_material_prices enable row level security;

create policy supplier_material_prices_select on public.supplier_material_prices
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy supplier_material_prices_insert on public.supplier_material_prices
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- quotes: sin policy de insert (el alta pasa siempre por create_quote, que
-- corre SECURITY DEFINER y garantiza la numeración atómica).
-- ---------------------------------------------------------------------------
alter table public.quotes enable row level security;

create policy quotes_select on public.quotes
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy quotes_update on public.quotes
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- quote_items
-- ---------------------------------------------------------------------------
alter table public.quote_items enable row level security;

create policy quote_items_select on public.quote_items
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy quote_items_insert on public.quote_items
  for insert to authenticated
  with check (public.is_org_operator(organization_id));

create policy quote_items_update on public.quote_items
  for update to authenticated
  using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

create policy quote_items_delete on public.quote_items
  for delete to authenticated
  using (public.is_org_operator(organization_id));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado para PDFs de cotización.
-- Path: organizations/{organization_id}/quotes/{quote_id}/cotizacion.pdf
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('quotes', 'quotes', false)
on conflict (id) do nothing;

create policy quotes_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quotes'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_member(((storage.foldername(name))[2])::uuid)
  );

create policy quotes_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'quotes'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_operator(((storage.foldername(name))[2])::uuid)
  );

create policy quotes_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'quotes'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_operator(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'quotes'
    and (storage.foldername(name))[1] = 'organizations'
    and public.is_org_operator(((storage.foldername(name))[2])::uuid)
  );
