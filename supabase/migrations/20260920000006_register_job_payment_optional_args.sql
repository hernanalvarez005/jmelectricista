-- Fase 3: register_job_payment tenía todos sus argumentos obligatorios,
-- forzando al caller a mandar `null` explícito para account/reference/notes/
-- receipt_path (opcionales por diseño). Se recrea con defaults para que el
-- tipado generado (Args) los marque opcionales — los parámetros con default
-- deben ir al final de la firma, así que p_client_request_id (obligatorio)
-- se reordena antes que ellos. drop explícito porque CREATE OR REPLACE no
-- permite cambiar el orden de los parámetros de una función existente.
drop function if exists public.register_job_payment(uuid, date, numeric, uuid, uuid, text, text, text, uuid);

create or replace function public.register_job_payment(
  p_job_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method_id uuid,
  p_client_request_id uuid,
  p_payment_account_id uuid default null,
  p_reference text default null,
  p_notes text default null,
  p_receipt_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select organization_id into v_org from public.jobs where id = p_job_id;
  if v_org is null then
    raise exception 'trabajo no encontrado';
  end if;

  if not public.is_org_operator(v_org) then
    raise exception 'not authorized';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount debe ser mayor a 0';
  end if;

  insert into public.job_payments (
    organization_id, job_id, payment_date, amount, payment_method_id,
    payment_account_id, reference, notes, receipt_path, client_request_id, created_by
  )
  values (
    v_org, p_job_id, p_payment_date, p_amount, p_payment_method_id,
    p_payment_account_id, p_reference, p_notes, p_receipt_path, p_client_request_id, auth.uid()
  )
  on conflict (organization_id, client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.job_payments
    where organization_id = v_org and client_request_id = p_client_request_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.register_job_payment(uuid, date, numeric, uuid, uuid, uuid, text, text, text) from public;
grant execute on function public.register_job_payment(uuid, date, numeric, uuid, uuid, uuid, text, text, text) to authenticated;
