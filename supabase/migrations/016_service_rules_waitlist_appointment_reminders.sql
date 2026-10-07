-- ============================================================
-- 016_service_rules_waitlist_appointment_reminders.sql
-- Bloque 8:
--   A. service_followup_rules: "este servicio vuelve en N meses".
--   B. waitlist_entries: lista de espera + RPCs de escritura.
--   C. appointment_responses: recordatorio de cita con enlace de
--      confirmación OPCIONAL del paciente, más RPCs de staff y dos RPCs
--      públicas por token (sin sesión).
-- Requiere: 015_quote_currency_and_inactive_clients.sql
-- Fuera de alcance: envío automático por WhatsApp API.
-- ============================================================

-- ============================================================
-- A. Reglas de regreso por servicio
-- ============================================================

create table service_followup_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  service_name text not null,
  -- Clave normalizada (sin tildes, minúsculas, espacios colapsados) para
  -- emparejar contra jobs.service_type sin depender de mayúsculas.
  service_key text generated always as (
    lower(regexp_replace(
      translate(trim(service_name), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
      '\s+', ' ', 'g'
    ))
  ) stored,
  months integer not null check (months between 1 and 60),
  reason text,
  created_at timestamptz not null default now(),
  constraint service_followup_rules_name_not_blank check (length(trim(service_name)) > 0),
  constraint service_followup_rules_name_len check (length(service_name) <= 120),
  constraint service_followup_rules_reason_len check (reason is null or length(reason) <= 120),
  constraint service_followup_rules_unique_service unique (company_id, service_key)
);

alter table service_followup_rules enable row level security;

create policy service_followup_rules_select on service_followup_rules
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy service_followup_rules_insert on service_followup_rules
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy service_followup_rules_update on service_followup_rules
  for update
  using (has_role_in_company(company_id, array['owner', 'office']))
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy service_followup_rules_delete on service_followup_rules
  for delete
  using (has_role_in_company(company_id, array['owner', 'office']));

grant select, insert, update, delete on service_followup_rules to authenticated;

comment on table service_followup_rules is
  'Regla "el servicio X vuelve en N meses". Se usa para sugerir la fecha de regreso al terminar una cita. Solo sugiere: el usuario siempre puede cambiarla.';

-- ============================================================
-- B. Lista de espera
-- ============================================================

create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  note text,
  service text,
  status text not null default 'waiting' check (status in ('waiting', 'booked', 'removed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint waitlist_note_len check (note is null or length(note) <= 200),
  constraint waitlist_service_len check (service is null or length(service) <= 120)
);

-- Una sola entrada "en espera" por cliente.
create unique index waitlist_one_waiting_per_client
  on waitlist_entries (company_id, client_id)
  where status = 'waiting';

create index waitlist_company_waiting_idx
  on waitlist_entries (company_id, created_at)
  where status = 'waiting';

alter table waitlist_entries enable row level security;

-- Solo lectura directa; toda escritura pasa por las RPCs de abajo.
create policy waitlist_entries_select on waitlist_entries
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

grant select on waitlist_entries to authenticated;

create or replace function add_to_waitlist(
  p_company_id uuid,
  p_client_id uuid,
  p_note text default null,
  p_service text default null
)
returns uuid
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  if not has_role_in_company(p_company_id, array['owner', 'office']) then
    raise exception 'No autorizado para gestionar la lista de espera';
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.company_id = p_company_id
  ) then
    raise exception 'Cliente no encontrado en esta empresa';
  end if;

  if exists (
    select 1 from public.waitlist_entries w
    where w.company_id = p_company_id and w.client_id = p_client_id and w.status = 'waiting'
  ) then
    raise exception 'Este cliente ya está en la lista de espera';
  end if;

  insert into public.waitlist_entries (company_id, client_id, note, service)
  values (
    p_company_id,
    p_client_id,
    nullif(trim(coalesce(p_note, '')), ''),
    nullif(trim(coalesce(p_service, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function add_to_waitlist(uuid, uuid, text, text) from public;
grant execute on function add_to_waitlist(uuid, uuid, text, text) to authenticated;

create or replace function resolve_waitlist_entry(p_entry_id uuid, p_status text)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_company uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  if p_status is null or p_status not in ('booked', 'removed') then
    raise exception 'Estado no válido';
  end if;

  select w.company_id into v_company
  from public.waitlist_entries w
  where w.id = p_entry_id and w.status = 'waiting';

  if v_company is null then
    raise exception 'Entrada no encontrada o ya resuelta';
  end if;

  if not has_role_in_company(v_company, array['owner', 'office']) then
    raise exception 'No autorizado para gestionar la lista de espera';
  end if;

  update public.waitlist_entries
  set status = p_status, resolved_at = now()
  where id = p_entry_id;
end;
$$;

revoke all on function resolve_waitlist_entry(uuid, text) from public;
grant execute on function resolve_waitlist_entry(uuid, text) to authenticated;

-- ============================================================
-- C. Recordatorio de cita + confirmación opcional del paciente
-- ============================================================
-- Es un RECORDATORIO: que el paciente no responda no es un problema.
-- Si abre el enlace puede confirmar o avisar que no podrá; la clínica
-- también puede marcarlo a mano. El token vive en una tabla aparte (no
-- en jobs) para que los técnicos, que leen jobs, nunca lo vean.

create table appointment_responses (
  job_id uuid primary key references jobs(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  response text check (response in ('confirmed', 'declined')),
  response_at timestamptz,
  response_source text check (response_source in ('patient', 'staff')),
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table appointment_responses enable row level security;

create policy appointment_responses_select on appointment_responses
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

grant select on appointment_responses to authenticated;

-- Si se reprograma la cita, la respuesta y el recordatorio anteriores
-- dejan de valer (el enlace sigue siendo el mismo).
create or replace function reset_appointment_response_on_reschedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scheduled_start_at is distinct from old.scheduled_start_at then
    update public.appointment_responses
    set response = null, response_at = null, response_source = null, reminded_at = null
    where job_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function reset_appointment_response_on_reschedule() from public;

drop trigger if exists trg_jobs_reset_appointment_response on jobs;
create trigger trg_jobs_reset_appointment_response
  after update of scheduled_start_at on jobs
  for each row
  execute function reset_appointment_response_on_reschedule();

-- ---------- staff: obtener (o crear) el enlace de una cita ----------
create or replace function prepare_appointment_link(p_job_id uuid)
returns uuid
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_company uuid;
  v_status text;
  v_start timestamptz;
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select j.company_id, j.status, j.scheduled_start_at
    into v_company, v_status, v_start
  from public.jobs j where j.id = p_job_id;

  if v_company is null then
    raise exception 'Cita no encontrada';
  end if;

  if not has_role_in_company(v_company, array['owner', 'office']) then
    raise exception 'No autorizado para gestionar recordatorios en esta empresa';
  end if;

  if v_status in ('completed', 'cancelled') or v_start is null then
    raise exception 'Esta cita no admite recordatorio';
  end if;

  insert into public.appointment_responses (job_id, company_id)
  values (p_job_id, v_company)
  on conflict (job_id) do nothing;

  select r.token into v_token from public.appointment_responses r where r.job_id = p_job_id;
  return v_token;
end;
$$;

revoke all on function prepare_appointment_link(uuid) from public;
grant execute on function prepare_appointment_link(uuid) to authenticated;

-- ---------- staff: marcar recordatorio enviado / respuesta manual ----------
create or replace function mark_appointment_reminded(p_job_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_company uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select j.company_id into v_company from public.jobs j where j.id = p_job_id;
  if v_company is null then
    raise exception 'Cita no encontrada';
  end if;

  if not has_role_in_company(v_company, array['owner', 'office']) then
    raise exception 'No autorizado para gestionar recordatorios en esta empresa';
  end if;

  insert into public.appointment_responses (job_id, company_id, reminded_at)
  values (p_job_id, v_company, now())
  on conflict (job_id) do update set reminded_at = now();
end;
$$;

revoke all on function mark_appointment_reminded(uuid) from public;
grant execute on function mark_appointment_reminded(uuid) to authenticated;

-- p_response null = borrar la respuesta (por error de marcado).
create or replace function set_appointment_response(p_job_id uuid, p_response text)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_company uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  if p_response is not null and p_response not in ('confirmed', 'declined') then
    raise exception 'Respuesta no válida';
  end if;

  select j.company_id into v_company from public.jobs j where j.id = p_job_id;
  if v_company is null then
    raise exception 'Cita no encontrada';
  end if;

  if not has_role_in_company(v_company, array['owner', 'office']) then
    raise exception 'No autorizado para gestionar recordatorios en esta empresa';
  end if;

  insert into public.appointment_responses (job_id, company_id, response, response_at, response_source)
  values (
    p_job_id, v_company, p_response,
    case when p_response is null then null else now() end,
    case when p_response is null then null else 'staff' end
  )
  on conflict (job_id) do update
    set response = excluded.response,
        response_at = excluded.response_at,
        response_source = excluded.response_source;
end;
$$;

revoke all on function set_appointment_response(uuid, text) from public;
grant execute on function set_appointment_response(uuid, text) to authenticated;

-- ---------- público: ver la cita por token ----------
-- Solo lo necesario para la página del paciente: nombre del negocio,
-- primer nombre, fecha/hora. NUNCA servicio, ids ni datos de salud.
-- Token inexistente = 0 filas (no da pistas a quien adivine).
create or replace function get_public_appointment(p_token uuid)
returns table (
  company_name text,
  company_logo_url text,
  company_phone text,
  client_first_name text,
  scheduled_start_at timestamptz,
  timezone text,
  response text,
  can_respond boolean
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
    j.scheduled_start_at,
    co.timezone,
    r.response,
    (j.status not in ('completed', 'cancelled')
      and j.scheduled_start_at is not null
      and j.scheduled_start_at > now())
  from public.appointment_responses r
  join public.jobs j on j.id = r.job_id
  join public.clients c on c.id = j.client_id
  join public.companies co on co.id = j.company_id
  where r.token = p_token;
$$;

revoke all on function get_public_appointment(uuid) from public;
grant execute on function get_public_appointment(uuid) to anon, authenticated;

-- ---------- público: responder ----------
-- Devuelve 'ok', 'not_available' (cita pasada/cancelada/completada) o
-- 'not_found'. Pensado para que el paciente pueda cambiar de opinión.
create or replace function respond_public_appointment(p_token uuid, p_response text)
returns text
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_job_id uuid;
  v_status text;
  v_start timestamptz;
begin
  if p_response is null or p_response not in ('confirmed', 'declined') then
    return 'not_found';
  end if;

  select r.job_id, j.status, j.scheduled_start_at
    into v_job_id, v_status, v_start
  from public.appointment_responses r
  join public.jobs j on j.id = r.job_id
  where r.token = p_token
  for update of r;

  if v_job_id is null then
    return 'not_found';
  end if;

  if v_status in ('completed', 'cancelled') or v_start is null or v_start <= now() then
    return 'not_available';
  end if;

  update public.appointment_responses
  set response = p_response, response_at = now(), response_source = 'patient'
  where job_id = v_job_id;

  return 'ok';
end;
$$;

revoke all on function respond_public_appointment(uuid, text) from public;
grant execute on function respond_public_appointment(uuid, text) to anon, authenticated;
