-- ============================================================
-- 022: Planes de tratamiento con abonos
-- ============================================================
-- Un plan es un tratamiento de varias visitas con un precio total que
-- el paciente paga en abonos (ej. ortodoncia US$600). Cada abono se
-- registra y se puede anular (queda en el historial, no se borra).
-- Solo dueño y recepción ven y escriben dinero; se escribe únicamente
-- con las RPCs de abajo. paid_amount se recalcula siempre desde la
-- suma de abonos no anulados.

create table treatment_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0 and length(name) <= 200),
  description text check (description is null or length(description) <= 2000),
  total numeric(12, 2) not null check (total > 0),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  currency text not null check (currency in ('NIO', 'USD')),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_treatment_plans_client on treatment_plans (company_id, client_id);

create table plan_payments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references treatment_plans(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'bank_transfer', 'card', 'check', 'other')),
  paid_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 500),
  recorded_by uuid references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_at timestamptz not null default now()
);

create index idx_plan_payments_plan on plan_payments (plan_id);

alter table treatment_plans enable row level security;
alter table plan_payments enable row level security;

create policy treatment_plans_select_admin on treatment_plans
  for select using (has_role_in_company(company_id, array['owner', 'office']));
create policy plan_payments_select_admin on plan_payments
  for select using (has_role_in_company(company_id, array['owner', 'office']));
-- Sin policies de INSERT/UPDATE/DELETE: solo las RPCs escriben.

-- ---------- crear plan (con abono inicial opcional) ----------
create or replace function create_treatment_plan(
  p_company_id uuid,
  p_client_id uuid,
  p_name text,
  p_total numeric,
  p_description text default null,
  p_initial_payment numeric default null,
  p_method text default 'cash'
)
returns treatment_plans
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_currency text;
  v_plan public.treatment_plans;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  if not has_role_in_company(p_company_id, array['owner', 'office']) then
    raise exception 'No autorizado para crear planes en esta empresa';
  end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.company_id = p_company_id) then
    raise exception 'El paciente no pertenece a esta empresa';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Escribe el nombre del tratamiento';
  end if;
  if length(p_name) > 200 then
    raise exception 'El nombre es demasiado largo';
  end if;

  if p_total is null or p_total <= 0 then
    raise exception 'El precio total debe ser mayor a cero';
  end if;

  if p_initial_payment is not null and p_initial_payment < 0 then
    raise exception 'El abono debe ser mayor a cero';
  end if;
  if coalesce(p_initial_payment, 0) > p_total then
    raise exception 'El abono excede el saldo pendiente';
  end if;

  select co.currency into v_currency from public.companies co where co.id = p_company_id;

  insert into public.treatment_plans (company_id, client_id, name, description, total, currency, created_by)
  values (p_company_id, p_client_id, btrim(p_name), nullif(btrim(p_description), ''), p_total, v_currency, auth.uid())
  returning * into v_plan;

  if coalesce(p_initial_payment, 0) > 0 then
    insert into public.plan_payments (plan_id, company_id, amount, method, recorded_by)
    values (v_plan.id, p_company_id, p_initial_payment, p_method, auth.uid());

    update public.treatment_plans tp
    set paid_amount = p_initial_payment, updated_at = now()
    where tp.id = v_plan.id
    returning * into v_plan;
  end if;

  return v_plan;
end;
$$;

revoke all on function create_treatment_plan(uuid, uuid, text, numeric, text, numeric, text) from public;
grant execute on function create_treatment_plan(uuid, uuid, text, numeric, text, numeric, text) to authenticated;

-- ---------- registrar un abono ----------
create or replace function record_plan_payment(
  p_plan_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_paid_at timestamptz default now(),
  p_note text default null
)
returns treatment_plans
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_plan public.treatment_plans;
  v_paid numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select * into v_plan from public.treatment_plans tp where tp.id = p_plan_id for update;
  if not found then
    raise exception 'Plan no encontrado';
  end if;

  if not has_role_in_company(v_plan.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para registrar abonos en esta empresa';
  end if;

  if v_plan.status = 'cancelled' then
    raise exception 'Un plan cancelado no admite abonos';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El abono debe ser mayor a cero';
  end if;

  if v_plan.paid_amount + p_amount > v_plan.total then
    raise exception 'El abono excede el saldo pendiente';
  end if;

  insert into public.plan_payments (plan_id, company_id, amount, method, paid_at, note, recorded_by)
  values (p_plan_id, v_plan.company_id, p_amount, p_method, coalesce(p_paid_at, now()), nullif(btrim(p_note), ''), auth.uid());

  select coalesce(sum(pp.amount), 0) into v_paid
  from public.plan_payments pp where pp.plan_id = p_plan_id and pp.voided_at is null;

  update public.treatment_plans tp
  set paid_amount = v_paid, updated_at = now()
  where tp.id = p_plan_id
  returning * into v_plan;

  return v_plan;
end;
$$;

revoke all on function record_plan_payment(uuid, numeric, text, timestamptz, text) from public;
grant execute on function record_plan_payment(uuid, numeric, text, timestamptz, text) to authenticated;

-- ---------- anular un abono ----------
create or replace function void_plan_payment(p_payment_id uuid, p_void_reason text)
returns treatment_plans
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_pay public.plan_payments;
  v_plan public.treatment_plans;
  v_paid numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select * into v_pay from public.plan_payments pp where pp.id = p_payment_id for update;
  if not found then
    raise exception 'Abono no encontrado';
  end if;

  if not has_role_in_company(v_pay.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para anular abonos en esta empresa';
  end if;

  if v_pay.voided_at is not null then
    raise exception 'Este abono ya fue anulado';
  end if;

  if p_void_reason is null or length(btrim(p_void_reason)) = 0 then
    raise exception 'El motivo de anulación es obligatorio';
  end if;

  update public.plan_payments
  set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_void_reason)
  where id = p_payment_id;

  select coalesce(sum(pp.amount), 0) into v_paid
  from public.plan_payments pp where pp.plan_id = v_pay.plan_id and pp.voided_at is null;

  update public.treatment_plans tp
  set paid_amount = v_paid, updated_at = now()
  where tp.id = v_pay.plan_id
  returning * into v_plan;

  return v_plan;
end;
$$;

revoke all on function void_plan_payment(uuid, text) from public;
grant execute on function void_plan_payment(uuid, text) to authenticated;

-- ---------- cambiar el estado del tratamiento ----------
create or replace function set_treatment_plan_status(p_plan_id uuid, p_status text)
returns treatment_plans
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_plan public.treatment_plans;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select * into v_plan from public.treatment_plans tp where tp.id = p_plan_id for update;
  if not found then
    raise exception 'Plan no encontrado';
  end if;

  if not has_role_in_company(v_plan.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para cambiar planes en esta empresa';
  end if;

  if p_status not in ('active', 'completed', 'cancelled') then
    raise exception 'Estado no válido';
  end if;

  update public.treatment_plans tp
  set status = p_status, updated_at = now()
  where tp.id = p_plan_id
  returning * into v_plan;

  return v_plan;
end;
$$;

revoke all on function set_treatment_plan_status(uuid, text) from public;
grant execute on function set_treatment_plan_status(uuid, text) to authenticated;
