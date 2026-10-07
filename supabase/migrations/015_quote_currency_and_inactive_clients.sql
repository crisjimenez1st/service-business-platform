-- ============================================================
-- 015_quote_currency_and_inactive_clients.sql
-- Bloque 7 (cont.):
--   A. Las cotizaciones nuevas toman la moneda del negocio
--      (companies.currency) en vez del default fijo 'NIO'.
--   B. get_inactive_clients: pacientes/clientes que dejaron de venir
--      (automatización "Pacientes inactivos").
--   C. resolve_inactive_client: registra el resultado de avisar a un
--      inactivo (agendó / más tarde / no le interesa) para que no
--      vuelva a aparecer cada día.
-- Requiere: 014_followups_and_business_type.sql
-- Fuera de alcance: envío automático por WhatsApp API.
-- ============================================================

-- ============================================================
-- A. Moneda de las cotizaciones
-- ============================================================
-- Ninguna ruta de creación de cotizaciones (insert directo, RPCs 005 y
-- 006) enviaba currency: todas caían en el default 'NIO' aunque el
-- negocio cobrara en dólares. Un trigger BEFORE INSERT cubre todas las
-- rutas a la vez. Las cotizaciones YA existentes NO se tocan: no hay
-- forma de saber en qué moneda se pensaron.

create or replace function set_quote_currency_from_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select c.currency into new.currency
  from public.companies c
  where c.id = new.company_id;

  if new.currency is null then
    new.currency := 'NIO';
  end if;
  return new;
end;
$$;

revoke all on function set_quote_currency_from_company() from public;

drop trigger if exists trg_quotes_set_currency on quotes;
create trigger trg_quotes_set_currency
  before insert on quotes
  for each row
  execute function set_quote_currency_from_company();

comment on function set_quote_currency_from_company() is
  'La moneda de una cotización nueva es la moneda del negocio en el momento de crearla (congelada después, igual que jobs.currency).';

-- ============================================================
-- B. get_inactive_clients
-- ============================================================
-- "Inactivo" = tuvo al menos una cita/trabajo completado y el último
-- fue hace más de p_months meses, no tiene nada agendado hacia
-- adelante, no tiene ya un seguimiento pendiente y nadie le ha
-- gestionado un aviso de seguimiento en los últimos p_months meses
-- (así quien ya fue avisado, pospuesto o descartado no reaparece).
-- Respeta contact_consent. Solo owner/office.

drop function if exists get_inactive_clients(uuid, integer);

create or replace function get_inactive_clients(
  p_company_id uuid,
  p_months integer default 6
)
returns table (
  client_id uuid,
  client_name text,
  client_phone text,
  client_whatsapp text,
  last_visit_at timestamptz,
  days_since_visit integer
)
language sql
security definer
volatile
set search_path = public
as $$
  with params as (
    select
      public.company_today(p_company_id) as today,
      greatest(1, least(coalesce(p_months, 6), 60)) as months
  ),
  last_visit as (
    select j.client_id, max(j.scheduled_start_at) as last_at
    from public.jobs j
    where j.company_id = p_company_id
      and j.status = 'completed'
      and j.scheduled_start_at is not null
    group by j.client_id
  )
  select
    c.id as client_id,
    c.name as client_name,
    c.phone as client_phone,
    c.whatsapp as client_whatsapp,
    lv.last_at as last_visit_at,
    (p.today - (lv.last_at at time zone co.timezone)::date) as days_since_visit
  from public.clients c
  join last_visit lv on lv.client_id = c.id
  join public.companies co on co.id = c.company_id
  cross join params p
  where c.company_id = p_company_id
    and c.contact_consent = true
    and (lv.last_at at time zone co.timezone)::date
          <= (p.today - make_interval(months => p.months))::date
    -- Nada agendado hacia adelante.
    and not exists (
      select 1 from public.jobs j2
      where j2.client_id = c.id
        and j2.company_id = p_company_id
        and j2.status not in ('completed', 'cancelled')
        and j2.scheduled_start_at is not null
        and j2.scheduled_start_at >= now()
    )
    -- Sin seguimiento pendiente ni gestionado recientemente.
    and not exists (
      select 1 from public.opportunities o
      where o.client_id = c.id
        and o.company_id = p_company_id
        and o.type = 'recall'
        and (
          o.status in ('active', 'postponed', 'contacted')
          or o.created_at >= (now() - make_interval(months => p.months))
        )
    )
    and has_role_in_company(p_company_id, array['owner', 'office'])
  order by lv.last_at asc, c.name asc;
$$;

revoke all on function get_inactive_clients(uuid, integer) from public;
grant execute on function get_inactive_clients(uuid, integer) to authenticated;

comment on function get_inactive_clients(uuid, integer) is
  'Clientes con consentimiento cuya última visita completada fue hace más de p_months meses, sin cita futura ni seguimiento pendiente o reciente. Owner/office.';

-- ============================================================
-- C. resolve_inactive_client
-- ============================================================
-- Guarda el resultado como una Opportunity type='recall' ya en su
-- estado final, en una sola operación atómica:
--   converted  -> agendó
--   postponed  -> más tarde (p_date obligatoria, hoy o futura)
--   discarded  -> no le interesa

drop function if exists resolve_inactive_client(uuid, uuid, text, date);

create or replace function resolve_inactive_client(
  p_company_id uuid,
  p_client_id uuid,
  p_action text,
  p_date date default null
)
returns uuid
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_today date;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  if not has_role_in_company(p_company_id, array['owner', 'office']) then
    raise exception 'No autorizado para gestionar avisos en esta empresa';
  end if;

  if p_action is null or p_action not in ('converted', 'postponed', 'discarded') then
    raise exception 'Acción no válida';
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.company_id = p_company_id
  ) then
    raise exception 'Cliente no encontrado en esta empresa';
  end if;

  v_today := public.company_today(p_company_id);

  if p_action = 'postponed' then
    if p_date is null or p_date < v_today then
      raise exception 'La nueva fecha debe ser hoy o posterior';
    end if;
  end if;

  insert into public.opportunities (
    company_id, client_id, type, title, description,
    estimated_value, status, due_date
  )
  values (
    p_company_id,
    p_client_id,
    'recall',
    'Paciente inactivo',
    null,
    0,
    p_action,
    case when p_action = 'postponed' then p_date else v_today end
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function resolve_inactive_client(uuid, uuid, text, date) from public;
grant execute on function resolve_inactive_client(uuid, uuid, text, date) to authenticated;

comment on function resolve_inactive_client(uuid, uuid, text, date) is
  'Registra el resultado de avisar a un cliente inactivo como un seguimiento (recall) ya resuelto, para que get_inactive_clients no lo vuelva a mostrar.';
