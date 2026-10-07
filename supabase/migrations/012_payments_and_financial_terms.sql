-- 012_payments_and_financial_terms.sql
--
-- Fase B2B, Bloque 6: Cobros y cuentas por cobrar. Introduce payments
-- como fuente de verdad de dinero recibido, jobs.paid_amount como
-- caché transaccional reconstruible (nunca la autoridad), jobs.currency
-- congelada por Job, jobs.due_date opcional, y cierra el hallazgo de
-- seguridad real detectado en la auditoría: jobs_update_admin permitía
-- UPDATE sin restricción de columnas -- ningún campo financiero debe
-- ser editable directo desde el cliente.

-- ============================================================
-- A. jobs: nuevas columnas
-- ============================================================

alter table jobs add column due_date date;

comment on column jobs.due_date is
  'Fecha de vencimiento opcional (crédito simple). Nullable, configurable después de crear el Job vía set_job_financial_terms -- nunca obligatoria al crear. Sin términos Net 15/30 ni cuotas en este bloque.';

alter table jobs add column currency text;

comment on column jobs.currency is
  'Moneda del Job, copiada UNA VEZ desde companies.currency al momento de crear el Job -- congelada de ahí en adelante. Un Job histórico nunca debe reinterpretarse si la empresa cambia su moneda por defecto más tarde. Todos los payments de este Job usan implícitamente esta moneda -- no existe payments.currency ni conversión FX en este bloque.';

-- Backfill seguro para Jobs existentes: toma la moneda ACTUAL de la
-- empresa de cada Job -- es la mejor aproximación disponible para
-- datos históricos que nunca tuvieron esta columna (no hay forma de
-- saber retroactivamente si la empresa tenía una moneda distinta en
-- el momento exacto en que cada Job se creó; se asume que no cambió).
update jobs j
set currency = c.currency
from companies c
where c.id = j.company_id
  and j.currency is null;

alter table jobs alter column currency set not null;
alter table jobs alter column currency set default 'NIO';

comment on column jobs.currency is
  'Moneda del Job, copiada UNA VEZ desde companies.currency al crear el Job -- congelada de ahí en adelante (ver backfill de esta migración para Jobs preexistentes, que tomó la moneda actual de su empresa en el momento de ejecutar 012). Todos los payments de este Job usan implícitamente esta moneda.';

-- jobs.paid_amount ya existe desde 007_jobs_schema.sql como nullable
-- sin default -- se ajusta aquí a NOT NULL DEFAULT 0 porque a partir
-- de este bloque es una caché transaccional activa (recalculada por
-- record_payment/void_payment), no un campo opcional sin uso.
update jobs set paid_amount = 0 where paid_amount is null;
alter table jobs alter column paid_amount set not null;
alter table jobs alter column paid_amount set default 0;

-- Invariante financiera a nivel de esquema: nunca puede existir una
-- fila con paid_amount mayor que total. Refuerza la regla de "no
-- sobrepago" de record_payment como garantía estructural, no solo
-- lógica de aplicación -- si total es null, la restricción no aplica
-- (Jobs sin total aún no fijado no pueden tener pagos de todas formas,
-- ver record_payment más abajo).
alter table jobs add constraint jobs_paid_amount_not_exceeds_total
  check (total is null or paid_amount <= total);

comment on constraint jobs_paid_amount_not_exceeds_total on jobs is
  'Invariante financiera a nivel de base de datos: paid_amount nunca puede superar total. record_payment ya valida esto antes de escribir, pero este CHECK es la última línea de defensa estructural -- ningún camino de escritura, presente o futuro, puede violarlo.';

-- ============================================================
-- B. PAYMENTS
-- ============================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_type text not null check (payment_type in ('deposit', 'partial', 'final', 'other')),
  method text not null check (method in ('cash', 'bank_transfer', 'card', 'check', 'other')),
  paid_at timestamptz not null default now(),
  reference text,
  note text,
  recorded_by uuid not null references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_at timestamptz not null default now(),

  -- FK compuesta hacia jobs(id, company_id) -- mismo patrón que
  -- job_photos/job_materials (007_jobs_schema.sql): imposible que un
  -- payment declare un company_id distinto al de su Job real.
  constraint payments_job_company_fk
    foreign key (job_id, company_id)
    references jobs(id, company_id)
    on delete cascade
);

comment on table payments is
  'Fuente de verdad de dinero recibido por Job. Sin policy de UPDATE/DELETE (ver sección RLS) -- corrección de un pago erróneo es void_payment (anula, con motivo obligatorio) + un nuevo INSERT vía record_payment, nunca una edición del pago original. jobs.paid_amount es una caché derivada de SUM(amount) WHERE voided_at IS NULL, recalculada dentro de la misma transacción que cada INSERT/void aquí -- payments es la autoridad, paid_amount es la proyección.';

comment on column payments.payment_type is
  'Etiqueta descriptiva (deposit/partial/final/other) -- NO tiene efecto en ningún cálculo de saldo o estado financiero. No se asume que el primer pago de un Job sea necesariamente un deposit.';

comment on column payments.company_id is
  'Denormalizado desde jobs.company_id a propósito -- permite que la policy RLS de esta tabla filtre directamente por company_id sin subquery a jobs en cada fila, mismo criterio que job_photos.company_id. La FK compuesta payments_job_company_fk garantiza que este valor nunca pueda divergir del company_id real del job_id referenciado.';

comment on column payments.voided_at is
  'Anulación (no DELETE) de un pago erróneo -- ver void_payment. Un pago anulado permanece visible en el historial, marcado con voided_at/voided_by/void_reason, y deja de contar en la suma de jobs.paid_amount.';

create index idx_payments_job_id on payments(job_id);
create index idx_payments_company_id on payments(company_id);

-- ============================================================
-- C. RLS -- payments (solo owner/office; sin UPDATE/DELETE directo)
-- ============================================================

alter table payments enable row level security;

create policy payments_select_admin on payments
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy payments_insert_admin on payments
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

comment on table payments is
  'Fuente de verdad de dinero recibido por Job. Sin policy de UPDATE/DELETE para NINGÚN rol -- ni siquiera owner/office puede editar o borrar un pago directamente; toda corrección pasa por void_payment (SECURITY DEFINER), que solo modifica las columnas de anulación, nunca amount/method/paid_at/reference/note. jobs.paid_amount es una caché derivada de SUM(amount) WHERE voided_at IS NULL, recalculada dentro de la misma transacción que cada INSERT/void aquí.';

-- technician: ninguna policy en absoluto sobre payments -- sin
-- SELECT/INSERT/UPDATE/DELETE. Ningún camino de lectura ni escritura
-- financiera para ese rol, consistente con get_my_assigned_jobs()
-- (Bloque 2), que ya excluye total/paid_amount explícitamente.

-- ============================================================
-- D. Privilegios de tabla -- jobs, revocar UPDATE de tabla completo
-- ============================================================
--
-- Hallazgo de la auditoría del Bloque 6: jobs_update_admin (007) es un
-- UPDATE sin restricción de columnas -- owner/office podían, vía
-- Supabase-js directo, hacer UPDATE jobs SET paid_amount = X sin pasar
-- por ninguna RPC. Confirmado antes de esta migración que el frontend
-- NUNCA hace UPDATE directo sobre jobs (las 4 escrituras existentes --
-- assign_job_technician, schedule_job, cancel_job, advance_job_status
-- -- ya son RPCs SECURITY DEFINER), así que revocar UPDATE de tabla no
-- rompe nada real. SECURITY DEFINER significa que esas 4 RPCs se
-- ejecutan con los privilegios del DUEÑO de la función, no del rol que
-- las invoca -- este REVOKE no las afecta en absoluto, confirmado
-- explícitamente antes de escribir esta migración.
--
-- La policy jobs_update_admin (007) sigue existiendo -- RLS sigue
-- siendo necesario para que las RPCs SECURITY DEFINER puedan escribir
-- (evalúan igual las policies de la tabla que modifican), pero ahora
-- ningún cliente puede iniciar un UPDATE directo sobre jobs en
-- absoluto, sin importar qué columna intente tocar.

revoke update on jobs from authenticated;

-- ============================================================
-- E. RPC: set_job_financial_terms
-- ============================================================
--
-- Único camino para fijar o corregir total/due_date. Reemplaza
-- cualquier necesidad de UPDATE directo sobre esas columnas -- ahora
-- estructuralmente imposible tras el REVOKE de la sección D.

create or replace function set_job_financial_terms(
  p_job_id uuid,
  p_total numeric,
  p_due_date date default null
)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select * into v_job
  from public.jobs j
  where j.id = p_job_id
  for update;

  if not found then
    raise exception 'Trabajo no encontrado: %', p_job_id;
  end if;

  if not has_role_in_company(v_job.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para modificar los términos financieros de este trabajo';
  end if;

  if v_job.status in ('completed', 'cancelled') then
    raise exception 'No se pueden modificar los términos financieros de un trabajo %', v_job.status;
  end if;

  if p_total is null or p_total <= 0 then
    raise exception 'El total debe ser un monto mayor a cero';
  end if;

  -- No permite bajar total por debajo de paid_amount actual -- evita
  -- que una corrección de precio deje al Job en un estado
  -- estructuralmente inconsistente (más pagado que el nuevo total).
  if p_total < v_job.paid_amount then
    raise exception 'El total (%) no puede ser menor al monto ya pagado (%)', p_total, v_job.paid_amount;
  end if;

  update public.jobs j
  set total = p_total, due_date = p_due_date
  where j.id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function set_job_financial_terms is
  'Único camino para fijar/corregir jobs.total y jobs.due_date -- UPDATE directo sobre jobs ya no es posible desde el cliente (ver REVOKE de la sección D). Rechaza total <= 0, rechaza bajar total por debajo de paid_amount ya registrado, rechaza sobre Jobs completed/cancelled.';

revoke all on function set_job_financial_terms(uuid, numeric, date) from public;
grant execute on function set_job_financial_terms(uuid, numeric, date) to authenticated;

-- ============================================================
-- F. RPC: record_payment
-- ============================================================

create or replace function record_payment(
  p_job_id uuid,
  p_amount numeric,
  p_payment_type text,
  p_method text,
  p_paid_at timestamptz default now(),
  p_reference text default null,
  p_note text default null
)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_new_paid_amount numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select * into v_job
  from public.jobs j
  where j.id = p_job_id
  for update;

  if not found then
    raise exception 'Trabajo no encontrado: %', p_job_id;
  end if;

  if not has_role_in_company(v_job.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para registrar pagos en este trabajo';
  end if;

  if v_job.total is null or v_job.total <= 0 then
    raise exception 'Este trabajo no tiene un total válido -- usa set_job_financial_terms primero';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero';
  end if;

  -- No sobrepago: el nuevo pago no puede hacer que paid_amount supere
  -- total. Se valida contra el saldo REAL antes de insertar -- el
  -- FOR UPDATE de arriba garantiza que esta comparación ve el estado
  -- más reciente incluso ante dos llamadas concurrentes sobre el
  -- mismo Job (la segunda espera a que la primera transacción
  -- termine antes de leer y validar).
  if v_job.paid_amount + p_amount > v_job.total then
    raise exception 'El pago (%) excede el saldo pendiente (%)', p_amount, (v_job.total - v_job.paid_amount);
  end if;

  insert into public.payments (
    company_id, job_id, amount, payment_type, method, paid_at, reference, note, recorded_by
  )
  values (
    v_job.company_id, p_job_id, p_amount, p_payment_type, p_method, p_paid_at, p_reference, p_note, auth.uid()
  );

  -- Recálculo AUTORITATIVO: SUM real de payments no anulados, no un
  -- incremento (paid_amount + amount). payments sigue siendo la
  -- fuente de verdad; esta línea solo reconstruye la caché desde ella
  -- dentro de la misma transacción -- nunca puede desincronizarse por
  -- una suma acumulada incorrecta a lo largo del tiempo.
  select coalesce(sum(p.amount), 0) into v_new_paid_amount
  from public.payments p
  where p.job_id = p_job_id and p.voided_at is null;

  update public.jobs j
  set paid_amount = v_new_paid_amount
  where j.id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function record_payment is
  'Registra un pago (owner/office) y recalcula jobs.paid_amount de forma AUTORITATIVA vía SUM(payments.amount) WHERE voided_at IS NULL -- nunca paid_amount + amount. Rechaza si el Job no tiene total válido, si el monto excede el saldo pendiente (no sobrepago), o si el caller no es owner/office de la empresa. FOR UPDATE sobre el Job garantiza consistencia ante llamadas concurrentes.';

revoke all on function record_payment(uuid, numeric, text, text, timestamptz, text, text) from public;
grant execute on function record_payment(uuid, numeric, text, text, timestamptz, text, text) to authenticated;

-- ============================================================
-- G. RPC: void_payment
-- ============================================================

create or replace function void_payment(
  p_payment_id uuid,
  p_void_reason text
)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_job public.jobs%rowtype;
  v_new_paid_amount numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select * into v_payment
  from public.payments p
  where p.id = p_payment_id
  for update;

  if not found then
    raise exception 'Pago no encontrado: %', p_payment_id;
  end if;

  if not has_role_in_company(v_payment.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para anular este pago';
  end if;

  if v_payment.voided_at is not null then
    raise exception 'Este pago ya fue anulado anteriormente';
  end if;

  if p_void_reason is null or btrim(p_void_reason) = '' then
    raise exception 'El motivo de anulación es obligatorio';
  end if;

  -- Bloquea el Job también -- el recálculo de paid_amount que sigue
  -- necesita la misma protección de concurrencia que record_payment.
  select * into v_job
  from public.jobs j
  where j.id = v_payment.job_id
  for update;

  update public.payments p
  set voided_at = now(), voided_by = auth.uid(), void_reason = p_void_reason
  where p.id = p_payment_id;

  -- Mismo recálculo autoritativo que record_payment -- SUM real, no
  -- una resta (paid_amount - amount).
  select coalesce(sum(p.amount), 0) into v_new_paid_amount
  from public.payments p
  where p.job_id = v_payment.job_id and p.voided_at is null;

  update public.jobs j
  set paid_amount = v_new_paid_amount
  where j.id = v_payment.job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function void_payment is
  'Anula un pago (owner/office), con motivo OBLIGATORIO -- nunca DELETE, nunca edición de amount/method/paid_at. Recalcula jobs.paid_amount de forma autoritativa vía SUM(payments.amount) WHERE voided_at IS NULL, igual que record_payment. Un Job cancelado con pagos NO se ve afectado automáticamente por esta función -- anular es siempre una acción explícita del usuario, nunca disparada por cancel_job.';

revoke all on function void_payment(uuid, text) from public;
grant execute on function void_payment(uuid, text) to authenticated;

-- ============================================================
-- H. RPC: get_company_receivables
-- ============================================================
--
-- Alimenta /collections directamente: por Job, cliente, total,
-- pagado, saldo, payment_status/is_overdue derivados -- sin que el
-- frontend tenga que calcular nada. payment_status e is_overdue son
-- SIEMPRE derivados aquí (o en get_job_payments más abajo), nunca
-- columnas almacenadas -- imposible que queden desincronizados de
-- total/paid_amount/due_date.

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
  is_overdue boolean
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
    (j.total - j.paid_amount) as balance,
    j.currency,
    j.due_date,
    case
      when j.paid_amount >= j.total then 'paid'
      when j.paid_amount > 0 then 'partial'
      else 'unpaid'
    end as payment_status,
    (j.due_date is not null and j.due_date < current_date and j.paid_amount < j.total) as is_overdue
  from public.jobs j
  join public.clients c on c.id = j.client_id
  where j.company_id = p_company_id
    and j.total is not null
    and j.total > 0
    and has_role_in_company(p_company_id, array['owner', 'office'])
  order by
    (j.due_date is not null and j.due_date < current_date and j.paid_amount < j.total) desc,
    j.due_date nulls last;
$$;

comment on function get_company_receivables is
  'Alimenta /collections: por Job con total válido, cliente, saldo y payment_status/is_overdue derivados (nunca almacenados). Solo owner/office -- has_role_in_company en el WHERE hace que devuelva 0 filas si quien llama no es admin activo de esa empresa. Jobs vencidos primero.';

revoke all on function get_company_receivables(uuid) from public;
grant execute on function get_company_receivables(uuid) to authenticated;

-- ============================================================
-- I. RPC: get_job_payments
-- ============================================================
--
-- Historial de pagos de un Job (incluye anulados, marcados como
-- tales) -- para la pestaña "Cobros" de /jobs/:id.

create or replace function get_job_payments(p_job_id uuid)
returns table (
  id uuid,
  amount numeric,
  payment_type text,
  method text,
  paid_at timestamptz,
  reference text,
  note text,
  recorded_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_at timestamptz
)
language sql
security definer
volatile
set search_path = public
as $$
  select
    p.id, p.amount, p.payment_type, p.method, p.paid_at, p.reference, p.note,
    p.recorded_by, p.voided_at, p.voided_by, p.void_reason, p.created_at
  from public.payments p
  join public.jobs j on j.id = p.job_id
  where p.job_id = p_job_id
    and has_role_in_company(j.company_id, array['owner', 'office'])
  order by p.paid_at desc;
$$;

comment on function get_job_payments is
  'Historial completo de pagos de un Job (incluye anulados, marcados con voided_at/voided_by/void_reason) -- para la pestaña Cobros de /jobs/:id. Solo owner/office de la empresa del Job.';

revoke all on function get_job_payments(uuid) from public;
grant execute on function get_job_payments(uuid) to authenticated;
