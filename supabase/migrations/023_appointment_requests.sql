-- ============================================================
-- 023: Enlace público para pedir cita
-- ============================================================
-- Cada clínica tiene un enlace público (token no adivinable) donde un
-- paciente deja su nombre, teléfono, servicio y cuándo le gustaría
-- venir. NO crea la cita: crea una solicitud que la recepción revisa y
-- agenda. La página pública solo muestra nombre, logo, teléfono de la
-- clínica y su lista de servicios. Límites contra abuso: máximo 3
-- solicitudes por teléfono por hora y máximo 100 pendientes por clínica.

alter table companies
  add column booking_token uuid not null default gen_random_uuid(),
  add column booking_enabled boolean not null default true;

create unique index idx_companies_booking_token on companies (booking_token);

create table appointment_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 120),
  phone text not null check (length(phone) <= 40),
  phone_key text not null,
  service text not null check (length(btrim(service)) between 1 and 120),
  preferred text check (preferred is null or length(preferred) <= 200),
  note text check (note is null or length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'handled', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_appointment_requests_company on appointment_requests (company_id, status, created_at desc);
create index idx_appointment_requests_phone on appointment_requests (company_id, phone_key, created_at);

alter table appointment_requests enable row level security;

create policy appointment_requests_select_admin on appointment_requests
  for select using (has_role_in_company(company_id, array['owner', 'office']));
-- Sin policies de INSERT/UPDATE/DELETE: solo las RPCs escriben.

-- ---------- público: datos de la clínica para el formulario ----------
create or replace function get_public_booking(p_token uuid)
returns table (
  company_name text,
  company_logo_url text,
  company_phone text,
  services text[]
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
    coalesce(
      (select array_agg(r.service_name order by r.service_name)
         from public.service_followup_rules r where r.company_id = co.id),
      '{}'::text[]
    )
  from public.companies co
  where co.booking_token = p_token and co.booking_enabled;
$$;

revoke all on function get_public_booking(uuid) from public;
grant execute on function get_public_booking(uuid) to anon, authenticated;

-- ---------- público: enviar la solicitud ----------
-- Devuelve 'ok', 'invalid', 'too_many' o 'not_found'.
create or replace function submit_appointment_request(
  p_token uuid,
  p_name text,
  p_phone text,
  p_service text,
  p_preferred text default null,
  p_note text default null
)
returns text
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_company uuid;
  v_key text;
begin
  select co.id into v_company
  from public.companies co
  where co.booking_token = p_token and co.booking_enabled;

  if v_company is null then
    return 'not_found';
  end if;

  v_key := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_key) < 7 or length(v_key) > 15 then
    return 'invalid';
  end if;
  v_key := right(v_key, 8);

  if p_name is null or length(btrim(p_name)) < 2 or length(p_name) > 120
     or p_service is null or length(btrim(p_service)) < 1 or length(p_service) > 120
     or length(coalesce(p_phone, '')) > 40
     or length(coalesce(p_preferred, '')) > 200
     or length(coalesce(p_note, '')) > 500 then
    return 'invalid';
  end if;

  if (select count(*) from public.appointment_requests ar
        where ar.company_id = v_company and ar.phone_key = v_key
          and ar.created_at > now() - interval '1 hour') >= 3 then
    return 'too_many';
  end if;

  if (select count(*) from public.appointment_requests ar
        where ar.company_id = v_company and ar.status = 'pending') >= 100 then
    return 'too_many';
  end if;

  insert into public.appointment_requests (company_id, name, phone, phone_key, service, preferred, note)
  values (v_company, btrim(p_name), btrim(p_phone), v_key, btrim(p_service),
          nullif(btrim(p_preferred), ''), nullif(btrim(p_note), ''));

  return 'ok';
end;
$$;

revoke all on function submit_appointment_request(uuid, text, text, text, text, text) from public;
grant execute on function submit_appointment_request(uuid, text, text, text, text, text) to anon, authenticated;

-- ---------- staff: marcar una solicitud ----------
create or replace function resolve_appointment_request(p_id uuid, p_status text)
returns appointment_requests
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_row public.appointment_requests;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select * into v_row from public.appointment_requests ar where ar.id = p_id for update;
  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if not has_role_in_company(v_row.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para gestionar solicitudes en esta empresa';
  end if;

  if p_status not in ('pending', 'handled', 'dismissed') then
    raise exception 'Estado no válido';
  end if;

  update public.appointment_requests ar
  set status = p_status,
      resolved_at = case when p_status = 'pending' then null else now() end
  where ar.id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function resolve_appointment_request(uuid, text) from public;
grant execute on function resolve_appointment_request(uuid, text) to authenticated;
