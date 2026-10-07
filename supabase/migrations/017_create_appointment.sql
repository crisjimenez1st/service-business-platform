-- ============================================================
-- 017: Nueva cita directa (sin cotización)
-- ============================================================
-- Hasta ahora un Job solo nacía de una cotización aceptada. Para una
-- clínica la recepción necesita agendar en segundos: paciente + servicio
-- + fecha/hora (+ precio opcional). Esta RPC crea el Job ya programado
-- (status 'scheduled'); de ahí siguen solos los recordatorios, el enlace
-- de confirmación y las reglas de regreso por servicio (migración 016).
--
-- Solo owner/office. La moneda se copia de la empresa y queda congelada
-- en el Job, igual que en el resto del flujo.

create or replace function create_appointment(
  p_company_id uuid,
  p_client_id uuid,
  p_service text,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz default null,
  p_total numeric default null,
  p_notes text default null
)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service text := nullif(btrim(coalesce(p_service, '')), '');
  v_currency text;
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  if not has_role_in_company(p_company_id, array['owner', 'office']) then
    raise exception 'No autorizado para crear citas en esta empresa';
  end if;

  if v_service is null then
    raise exception 'Elige el servicio de la cita';
  end if;
  if char_length(v_service) > 120 then
    raise exception 'El nombre del servicio es demasiado largo (máximo 120 caracteres)';
  end if;

  if p_scheduled_start_at is null then
    raise exception 'Indica la fecha y hora de la cita';
  end if;
  if p_scheduled_end_at is not null and p_scheduled_end_at < p_scheduled_start_at then
    raise exception 'La hora de fin no puede ser anterior a la de inicio';
  end if;

  if p_total is not null and p_total <= 0 then
    raise exception 'El precio debe ser mayor a cero (o déjalo vacío)';
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.company_id = p_company_id
  ) then
    raise exception 'El paciente no pertenece a esta empresa';
  end if;

  select c.currency into v_currency from public.companies c where c.id = p_company_id;

  insert into public.jobs (
    company_id, client_id, service_type, status,
    scheduled_start_at, scheduled_end_at, total, currency, notes
  )
  values (
    p_company_id, p_client_id, v_service, 'scheduled',
    p_scheduled_start_at, p_scheduled_end_at, p_total,
    coalesce(v_currency, 'NIO'), nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning * into v_job;

  return v_job;
end;
$$;

comment on function create_appointment is
  'Crea una cita (Job programado) directamente, sin cotización. owner/office. Valida servicio, fecha de inicio, orden de fechas, precio > 0 opcional y que el paciente sea de la empresa. Copia la moneda de la empresa al Job.';

revoke all on function create_appointment(uuid, uuid, text, timestamptz, timestamptz, numeric, text) from public;
grant execute on function create_appointment(uuid, uuid, text, timestamptz, timestamptz, numeric, text) to authenticated;
