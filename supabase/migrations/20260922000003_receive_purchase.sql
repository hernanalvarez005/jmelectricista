-- Fase 4: recepción de compra. Transaccional e idempotente: el lock de la fila
-- de la compra + el chequeo de estado garantizan que reenviarla (doble click,
-- retry, requests concurrentes) genere movimientos una sola vez.
--
-- Política de permisos: crear/editar borradores = operator (worker incluido);
-- recibir y cancelar = admin/owner, porque recibir una compra fija valor de
-- inventario (mismo criterio que anular cobros e inicializar valoración).
create or replace function public.receive_purchase(p_purchase_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_status text;
  item record;
  n_items integer;
begin
  select organization_id, status into v_org, v_status
  from public.purchases where id = p_purchase_id for update;

  if v_org is null then
    raise exception 'compra no encontrada';
  end if;

  if not public.is_org_admin(v_org) then
    raise exception 'not authorized';
  end if;

  if v_status = 'received' then
    return 'already_received';
  end if;

  if v_status = 'cancelled' then
    raise exception 'una compra cancelada no se puede recibir';
  end if;

  select count(*) into n_items from public.purchase_items where purchase_id = p_purchase_id;
  if n_items = 0 then
    raise exception 'la compra no tiene ítems';
  end if;

  perform set_config('app.receiving_purchase', 'on', true);

  -- Orden estable por material para evitar deadlocks entre compras concurrentes.
  for item in
    select id, material_id, quantity, unit_cost
    from public.purchase_items
    where purchase_id = p_purchase_id
    order by material_id, sort_order, id
  loop
    insert into public.stock_movements (
      organization_id, material_id, movement_type, quantity, unit_cost,
      purchase_id, purchase_item_id, notes, created_by
    )
    values (
      v_org, item.material_id, 'in', item.quantity, item.unit_cost,
      p_purchase_id, item.id, 'Ingreso por compra', auth.uid()
    );
  end loop;

  perform set_config('app.purchase_transition', 'on', true);
  update public.purchases
  set status = 'received', received_at = now(), received_by = auth.uid()
  where id = p_purchase_id;

  return 'received';
end;
$$;

revoke all on function public.receive_purchase(uuid) from public;
grant execute on function public.receive_purchase(uuid) to authenticated;
