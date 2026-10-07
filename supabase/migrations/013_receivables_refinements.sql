-- ============================================================
-- 013_receivables_refinements.sql
-- Bloque 6: refinamientos de cuentas por cobrar
--   1. get_company_receivables: excluye cancelados sin pagos, marca
--      requires_review en cancelados con pagos activos.
--   2. get_receivables_summary: una fila por moneda (nunca mezclar monedas).
--   3. get_unpriced_jobs: trabajos completados sin total válido.
-- Requiere: 012_payments_and_financial_terms.sql
-- ============================================================

-- ---------- 1. get_company_receivables ----------
drop function if exists get_company_receivables(uuid);

create or replace function get_company_receivables(p_company_id uuid)
returns table (
  job_id uuid,
  client_id uuid,
  client_name text,
  service_type text,
  status text,
  total numeric,
  paid_amount numeric,
  balance numeric,
  currency text,
  due_date date,
  payment_status text,
  is_overdue boolean,
  requires_review boolean
)
language sql
security definer
volatile
set search_path = public
as $$
  select
    j.id as job_id,
    j.client_id,
    c.name as client_name,
    j.service_type,
    j.status,
    j.total,
    j.paid_amount,
    case when j.status = 'cancelled' then 0 else (j.total - j.paid_amount) end as balance,
    j.currency,
    j.due_date,
    case
      when j.paid_amount >= j.total then 'paid'
      when j.paid_amount > 0 then 'partial'
      else 'unpaid'
    end as payment_status,
    (j.status <> 'cancelled'
      and j.due_date is not null
      and j.due_date < current_date
      and j.paid_amount < j.total) as is_overdue,
    (j.status = 'cancelled' and j.paid_amount > 0) as requires_review
  from public.jobs j
  join public.clients c on c.id = j.client_id
  where j.company_id = p_company_id
    and j.total is not null
    and j.total > 0
    and not (j.status = 'cancelled' and j.paid_amount = 0)
    and has_role_in_company(p_company_id, array['owner','office'])
  order by
    (j.status <> 'cancelled'
      and j.due_date is not null
      and j.due_date < current_date
      and j.paid_amount < j.total) desc,
    j.due_date nulls last;
$$;

revoke all on function get_company_receivables(uuid) from public;
grant execute on function get_company_receivables(uuid) to authenticated;

comment on function get_company_receivables(uuid) is
  'Cuentas por cobrar de la empresa (owner/office). Cancelados sin pagos se excluyen; cancelados con pagos salen con balance 0 y requires_review = true.';

-- ---------- 2. get_receivables_summary ----------
drop function if exists get_receivables_summary(uuid);

create or replace function get_receivables_summary(p_company_id uuid)
returns table (
  currency text,
  outstanding numeric,
  overdue_amount numeric,
  overdue_count bigint,
  open_count bigint
)
language sql
security definer
volatile
set search_path = public
as $$
  select
    j.currency,
    coalesce(sum(j.total - j.paid_amount), 0) as outstanding,
    coalesce(sum(j.total - j.paid_amount) filter (
      where j.due_date is not null and j.due_date < current_date
    ), 0) as overdue_amount,
    count(*) filter (
      where j.due_date is not null and j.due_date < current_date
    ) as overdue_count,
    count(*) as open_count
  from public.jobs j
  where j.company_id = p_company_id
    and j.total is not null
    and j.total > 0
    and j.status <> 'cancelled'
    and j.paid_amount < j.total
    and has_role_in_company(p_company_id, array['owner','office'])
  group by j.currency
  order by j.currency;
$$;

revoke all on function get_receivables_summary(uuid) from public;
grant execute on function get_receivables_summary(uuid) to authenticated;

comment on function get_receivables_summary(uuid) is
  'Totales por cobrar y vencidos, una fila por moneda. Nunca suma monedas distintas.';

-- ---------- 3. get_unpriced_jobs ----------
drop function if exists get_unpriced_jobs(uuid);

create or replace function get_unpriced_jobs(p_company_id uuid)
returns table (
  job_id uuid,
  client_id uuid,
  client_name text,
  service_type text,
  updated_at timestamptz
)
language sql
security definer
volatile
set search_path = public
as $$
  select
    j.id as job_id,
    j.client_id,
    c.name as client_name,
    j.service_type,
    j.updated_at
  from public.jobs j
  join public.clients c on c.id = j.client_id
  where j.company_id = p_company_id
    and j.status = 'completed'
    and (j.total is null or j.total <= 0)
    and has_role_in_company(p_company_id, array['owner','office'])
  order by j.updated_at desc;
$$;

revoke all on function get_unpriced_jobs(uuid) from public;
grant execute on function get_unpriced_jobs(uuid) to authenticated;

comment on function get_unpriced_jobs(uuid) is
  'Trabajos completados sin total válido (dinero no facturado). set_job_financial_terms rechaza completed: la corrección del precio es una decisión aparte.';
