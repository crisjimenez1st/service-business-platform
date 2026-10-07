-- 014_followups_and_business_type.sql
--
-- Bloque 7 (primera parte): base de datos para "Seguimiento y
-- recordatorios" orientado a clínicas (dentales y médicas) y otros
-- negocios de gestión de clientes. El producto sigue siendo uno solo:
-- el tipo de negocio solo decide el LENGUAJE y el menú de la app
-- (Paciente/Cita/Doctor vs Cliente/Trabajo/Técnico), no un esquema
-- distinto.
--
-- Qué hace:
--   A. companies.business_type + create_company_for_current_user con
--      tipo de negocio + set_company_business_type (solo owner).
--   B. clients.contact_consent: si el cliente/paciente aceptó recibir
--      recordatorios. Quien no lo aceptó nunca aparece en "a quién
--      avisar hoy".
--   C. Seguimientos = opportunities con type = 'recall' (no hay tabla
--      nueva): índice para la consulta diaria y get_followups_due.
--   D. create_client_with_followup: registrar al cliente y su primer
--      seguimiento ("¿cuándo debe volver?") en una sola operación
--      atómica.
--   E. company_today(): "hoy" en la zona horaria de la EMPRESA, y
--      get_company_receivables / get_receivables_summary la usan en
--      vez de current_date (UTC). Corrige el desfase de hasta 6 horas
--      en vencimientos señalado al cerrar el Bloque 6.
--
-- Fuera de alcance (deliberado): envío automático por WhatsApp API,
-- expediente clínico, odontograma, datos clínicos de cualquier tipo.

-- ============================================================
-- A. Tipo de negocio
-- ============================================================

alter table companies
  add column business_type text not null default 'technical_services'
  check (business_type in ('dental', 'medical', 'technical_services', 'other'));

comment on column companies.business_type is
  'Tipo de negocio de la empresa. Solo afecta el lenguaje y el menú de la app (terminología), no el esquema. Las empresas existentes quedan como technical_services (el mercado original del producto).';

-- create_company_for_current_user ahora acepta el tipo de negocio. Se
-- elimina la versión de un solo argumento (en vez de crear un
-- overload) para que la llamada actual del frontend -- solo
-- p_company_name -- siga resolviendo a UNA función, usando el default.
drop function if exists create_company_for_current_user(text);

create or replace function create_company_for_current_user(
  p_company_name text,
  p_business_type text default 'other'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_company_id uuid;
begin
  -- El id del usuario sale SIEMPRE de auth.uid(), nunca de un parámetro
  -- (ver 004_company_creation.sql).
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'No autenticado: se requiere una sesión activa para crear una empresa';
  end if;

  if p_company_name is null or length(trim(p_company_name)) = 0 then
    raise exception 'El nombre de la empresa es obligatorio';
  end if;

  if length(p_company_name) > 200 then
    raise exception 'El nombre de la empresa es demasiado largo';
  end if;

  if p_business_type is null
     or p_business_type not in ('dental', 'medical', 'technical_services', 'other') then
    raise exception 'Tipo de negocio no válido';
  end if;

  insert into public.companies (name, business_type)
  values (trim(p_company_name), p_business_type)
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company_id, v_user_id, 'owner', 'active');

  return v_company_id;
end;
$$;

comment on function create_company_for_current_user is
  'Crea una empresa con su tipo de negocio y asigna al usuario autenticado actual (auth.uid(), nunca un parámetro externo) como owner activo, de forma atómica.';

revoke all on function create_company_for_current_user(text, text) from public;
grant execute on function create_company_for_current_user(text, text) to authenticated;

-- Cambio de tipo de negocio de una empresa existente. RPC (y no UPDATE
-- directo) para que solo el owner pueda hacerlo y solo con valores
-- válidos.
create or replace function set_company_business_type(
  p_company_id uuid,
  p_business_type text
)
returns companies
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_company public.companies%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  if not has_role_in_company(p_company_id, array['owner']) then
    raise exception 'No autorizado para cambiar el tipo de negocio de esta empresa';
  end if;

  if p_business_type is null
     or p_business_type not in ('dental', 'medical', 'technical_services', 'other') then
    raise exception 'Tipo de negocio no válido';
  end if;

  update public.companies c
     set business_type = p_business_type
   where c.id = p_company_id
  returning c.* into v_company;

  return v_company;
end;
$$;

comment on function set_company_business_type is
  'Cambia el tipo de negocio (terminología de la app). Solo owner de la empresa.';

revoke all on function set_company_business_type(uuid, text) from public;
grant execute on function set_company_business_type(uuid, text) to authenticated;

-- ============================================================
-- B. Consentimiento de contacto
-- ============================================================

alter table clients
  add column contact_consent boolean not null default true;

comment on column clients.contact_consent is
  'true = el cliente/paciente acepta recibir recordatorios; false = no contactar. Quien tiene false nunca aparece en get_followups_due. Default true para los clientes existentes (relación comercial previa); el registro de pacientes en clínicas lo pregunta explícitamente.';

-- ============================================================
-- C. Seguimientos (opportunities.type = 'recall')
-- ============================================================

-- La consulta diaria "a quién avisar hoy" filtra por empresa, estado
-- abierto y fecha de vencimiento.
create index if not exists opportunities_followups_due_idx
  on opportunities (company_id, due_date)
  where status in ('active', 'postponed');

-- ============================================================
-- E. "Hoy" en la zona horaria de la empresa
-- ============================================================

create or replace function company_today(p_company_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone c.timezone)::date
  from public.companies c
  where c.id = p_company_id;
$$;

comment on function company_today is
  'Fecha de hoy en la zona horaria de la empresa (companies.timezone), no en UTC. Solo para uso interno de otras funciones SECURITY DEFINER: sin permiso de ejecución para usuarios.';

revoke all on function company_today(uuid) from public;
revoke all on function company_today(uuid) from authenticated;
revoke all on function company_today(uuid) from anon;

-- get_company_receivables: misma forma de salida que en 013, solo
-- cambia current_date -> company_today(p_company_id).
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
      and j.due_date < public.company_today(p_company_id)
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
      and j.due_date < public.company_today(p_company_id)
      and j.paid_amount < j.total) desc,
    j.due_date nulls last;
$$;

-- get_receivables_summary: igual que en 013 con company_today.
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
      where j.due_date is not null and j.due_date < public.company_today(p_company_id)
    ), 0) as overdue_amount,
    count(*) filter (
      where j.due_date is not null and j.due_date < public.company_today(p_company_id)
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

-- ============================================================
-- C (cont.). get_followups_due: "a quién avisar hoy"
-- ============================================================

drop function if exists get_followups_due(uuid);

create or replace function get_followups_due(p_company_id uuid)
returns table (
  opportunity_id uuid,
  client_id uuid,
  client_name text,
  client_phone text,
  client_whatsapp text,
  category text,
  title text,
  reason text,
  status text,
  due_date date,
  days_overdue integer,
  last_contacted_at timestamptz,
  last_visit_at timestamptz
)
language sql
security definer
volatile
set search_path = public
as $$
  select
    o.id as opportunity_id,
    o.client_id,
    c.name as client_name,
    c.phone as client_phone,
    c.whatsapp as client_whatsapp,
    o.type as category,
    o.title,
    o.description as reason,
    o.status,
    o.due_date,
    (public.company_today(p_company_id) - o.due_date) as days_overdue,
    o.last_contacted_at,
    -- Última visita: el trabajo/cita completado más reciente del cliente.
    (
      select max(j.scheduled_start_at)
      from public.jobs j
      where j.client_id = c.id
        and j.company_id = o.company_id
        and j.status = 'completed'
    ) as last_visit_at
  from public.opportunities o
  join public.clients c on c.id = o.client_id
  where o.company_id = p_company_id
    and o.status in ('active', 'postponed')
    and o.due_date is not null
    and o.due_date <= public.company_today(p_company_id)
    and c.contact_consent = true
    and has_role_in_company(p_company_id, array['owner','office'])
  order by o.due_date asc, c.name asc;
$$;

comment on function get_followups_due is
  'Seguimientos vencidos o de hoy (zona horaria de la empresa), solo de clientes con contact_consent = true, para la pantalla "a quién avisar hoy". Excluye los ya contactados, convertidos o descartados. Solo owner/office.';

revoke all on function get_followups_due(uuid) from public;
grant execute on function get_followups_due(uuid) to authenticated;

-- ============================================================
-- D. Registrar cliente + primer seguimiento, atómico
-- ============================================================

create or replace function create_client_with_followup(
  p_company_id uuid,
  p_name text,
  p_phone text,
  p_whatsapp text default null,
  p_contact_consent boolean default true,
  p_followup_due_date date default null,
  p_followup_title text default null,
  p_followup_reason text default null
)
returns clients
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  if not has_role_in_company(p_company_id, array['owner', 'office']) then
    raise exception 'No autorizado para registrar clientes en esta empresa';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre es obligatorio';
  end if;

  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'El teléfono es obligatorio';
  end if;

  if p_followup_due_date is not null
     and p_followup_due_date < public.company_today(p_company_id) then
    raise exception 'La fecha de seguimiento no puede ser anterior a hoy';
  end if;

  insert into public.clients (company_id, name, phone, whatsapp, contact_consent)
  values (
    p_company_id,
    trim(p_name),
    trim(p_phone),
    nullif(trim(coalesce(p_whatsapp, '')), ''),
    coalesce(p_contact_consent, true)
  )
  returning * into v_client;

  -- Seguimiento opcional: "¿cuándo debe volver?". Sin valor estimado
  -- (no es una venta cotizada todavía).
  if p_followup_due_date is not null then
    insert into public.opportunities (
      company_id, client_id, type, title, description,
      estimated_value, status, due_date
    )
    values (
      p_company_id,
      v_client.id,
      'recall',
      coalesce(nullif(trim(coalesce(p_followup_title, '')), ''), 'Control de seguimiento'),
      nullif(trim(coalesce(p_followup_reason, '')), ''),
      0,
      'active',
      p_followup_due_date
    );
  end if;

  return v_client;
end;
$$;

comment on function create_client_with_followup is
  'Registra un cliente/paciente y, si se indica fecha, su primer seguimiento (opportunities.type = recall) en una sola transacción. Solo owner/office.';

revoke all on function create_client_with_followup(uuid, text, text, text, boolean, date, text, text) from public;
grant execute on function create_client_with_followup(uuid, text, text, text, boolean, date, text, text) to authenticated;
