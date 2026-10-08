-- ============================================================
-- 019: Recibos de pago con enlace público
-- ============================================================
-- Cada pago puede tener un enlace público (token no adivinable) con su
-- recibo. La página pública solo muestra: negocio, nombre de pila del
-- paciente, servicio, monto, fecha, método y saldo. No expone ids,
-- teléfonos del paciente ni notas internas. Un pago anulado deja de
-- mostrar el monto. Mismo patrón que los enlaces de cotización y de cita.

create table payment_receipts (
  payment_id uuid primary key references payments(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table payment_receipts enable row level security;

create policy payment_receipts_select_admin on payment_receipts
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));
-- Sin policies de INSERT/UPDATE/DELETE: solo las RPCs de abajo escriben.

-- ---------- staff: obtener (o crear) el token del recibo de un pago ----------
create or replace function prepare_payment_receipt(p_payment_id uuid)
returns uuid
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_company uuid;
  v_voided timestamptz;
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select p.company_id, p.voided_at into v_company, v_voided
  from public.payments p where p.id = p_payment_id;

  if v_company is null then
    raise exception 'Pago no encontrado';
  end if;

  if not has_role_in_company(v_company, array['owner', 'office']) then
    raise exception 'No autorizado para emitir recibos en esta empresa';
  end if;

  if v_voided is not null then
    raise exception 'Este pago fue anulado: no admite recibo';
  end if;

  insert into public.payment_receipts (payment_id, company_id)
  values (p_payment_id, v_company)
  on conflict (payment_id) do nothing;

  select r.token into v_token from public.payment_receipts r where r.payment_id = p_payment_id;
  return v_token;
end;
$$;

revoke all on function prepare_payment_receipt(uuid) from public;
grant execute on function prepare_payment_receipt(uuid) to authenticated;

-- ---------- público: ver el recibo ----------
create or replace function get_public_receipt(p_token uuid)
returns table (
  company_name text,
  company_logo_url text,
  company_phone text,
  client_first_name text,
  service_name text,
  amount numeric,
  currency text,
  method text,
  paid_at timestamptz,
  timezone text,
  job_total numeric,
  balance numeric,
  receipt_code text,
  voided boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    co.name,
    co.logo_url,
    co.phone,
    split_part(trim(c.name), ' ', 1),
    j.service_type,
    case when p.voided_at is null then p.amount end,
    j.currency,
    p.method,
    p.paid_at,
    co.timezone,
    j.total,
    case when j.total is null then null else greatest(j.total - j.paid_amount, 0) end,
    upper(substr(md5(p.id::text), 1, 8)),
    (p.voided_at is not null)
  from public.payment_receipts r
  join public.payments p on p.id = r.payment_id
  join public.jobs j on j.id = p.job_id
  join public.clients c on c.id = j.client_id
  join public.companies co on co.id = p.company_id
  where r.token = p_token;
$$;

revoke all on function get_public_receipt(uuid) from public;
grant execute on function get_public_receipt(uuid) to anon, authenticated;
