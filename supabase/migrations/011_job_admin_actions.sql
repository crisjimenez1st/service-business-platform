-- 011_job_admin_actions.sql
--
-- Fase B2B, Bloque 5: acciones administrativas sobre Jobs para
-- owner/office -- cancelar (con auditoría) y avanzar estado
-- manualmente, sin permitir saltos arbitrarios que rompan la
-- integridad de reportes/cobros futuros construidos sobre el
-- historial de estados.

-- ============================================================
-- A. Esquema: columnas de cancelación
-- ============================================================

alter table jobs add column cancellation_reason text;
alter table jobs add column cancellation_category text
  check (cancellation_category is null or cancellation_category in (
    'client_request', 'no_show', 'rescheduled_elsewhere', 'other'
  ));
alter table jobs add column cancelled_at timestamptz;
alter table jobs add column cancelled_by uuid references auth.users(id);

comment on column jobs.cancellation_reason is
  'Motivo de texto libre, OBLIGATORIO cuando status pasa a cancelled (exigido por cancel_job, no por CHECK de tabla -- ver esa función). Se conserva para historial/auditoría; el Job nunca se borra al cancelarse.';

comment on column jobs.cancellation_category is
  'Categoría opcional de cancelación -- columna lista desde ahora para cuando el producto defina categorías reales de negocio; cancel_job la acepta pero no la exige todavía (el motivo de texto es lo obligatorio en este bloque). Set inicial genérico vía CHECK, ampliable en una migración futura con ALTER TABLE ... DROP CONSTRAINT + ADD CONSTRAINT.';

comment on column jobs.cancelled_at is
  'Momento real de cancelación, escrito por cancel_job -- nunca por UPDATE directo.';

comment on column jobs.cancelled_by is
  'Quién canceló (auth.uid() en el momento de la llamada) -- referencia a auth.users, no a company_members, porque sigue siendo válida aunque esa persona deje la empresa después.';

-- ============================================================
-- B. RPC: cancel_job
-- ============================================================
--
-- Permitido desde new/scheduled/en_route/in_progress/paused.
-- Terminal (completed, cancelled) queda fuera -- no se cancela algo ya
-- terminado, y no se cancela dos veces. Motivo de texto OBLIGATORIO
-- (validado aquí, no delegable a un CHECK de columna porque el CHECK
-- no puede saber si status está cambiando A cancelled en este UPDATE
-- específico). El Job nunca se borra -- permanece en la tabla con su
-- estado terminal y su auditoría completa.

create or replace function cancel_job(
  p_job_id uuid,
  p_reason text,
  p_category text default null
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
    raise exception 'No autorizado para cancelar este trabajo';
  end if;

  if v_job.status not in ('new', 'scheduled', 'en_route', 'in_progress', 'paused') then
    raise exception 'No se puede cancelar un trabajo en estado % -- ya está finalizado', v_job.status;
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo de cancelación es obligatorio';
  end if;

  update public.jobs j
  set
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancellation_category = p_category,
    cancelled_at = now(),
    cancelled_by = auth.uid()
  where j.id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function cancel_job is
  'Cancela un Job (owner/office), con motivo de texto obligatorio y categoría opcional. Permitido desde new/scheduled/en_route/in_progress/paused; rechazado en completed/cancelled. Escribe cancelled_at/cancelled_by para auditoría real -- el Job nunca se borra, permanece con su historial completo.';

revoke all on function cancel_job(uuid, text, text) from public;
grant execute on function cancel_job(uuid, text, text) to authenticated;

-- ============================================================
-- C. RPC: advance_job_status
-- ============================================================
--
-- Permite a owner/office avanzar el estado de CUALQUIER Job de su
-- empresa (a diferencia de update_job_as_technician, que exige que el
-- Job esté asignado al caller) -- cubre casos donde el técnico no
-- puede actualizar su propio estado (sin señal, sin acceso al
-- teléfono, etc.) y la oficina necesita reflejarlo manualmente.
--
-- Usa EXACTAMENTE la misma tabla de transiciones de un paso que
-- update_job_as_technician (008_technician_access.sql) -- nunca
-- permite saltos como new->completed o scheduled->completed directo,
-- para proteger la integridad de reportes/cobros que dependerán de
-- este historial de estados en bloques futuros. La programación
-- (new<->scheduled) sigue siendo exclusiva de schedule_job -- esta
-- función no la toca; empieza en scheduled->en_route.

create or replace function advance_job_status(
  p_job_id uuid,
  p_new_status text
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
    raise exception 'No autorizado para cambiar el estado de este trabajo';
  end if;

  -- Misma tabla de transiciones que update_job_as_technician -- ver
  -- comentario de cabecera. new<->scheduled queda fuera a propósito
  -- (eso es exclusivo de schedule_job).
  if not (
    (v_job.status = 'scheduled' and p_new_status = 'en_route')
    or (v_job.status = 'en_route' and p_new_status = 'in_progress')
    or (v_job.status = 'in_progress' and p_new_status = 'paused')
    or (v_job.status = 'in_progress' and p_new_status = 'completed')
    or (v_job.status = 'paused' and p_new_status = 'in_progress')
  ) then
    raise exception 'Transición de estado no permitida: % -> %', v_job.status, p_new_status;
  end if;

  update public.jobs j
  set status = p_new_status
  where j.id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function advance_job_status is
  'Avanza el estado de un Job un paso, para owner/office, sobre CUALQUIER Job de la empresa (no exige asignación propia, a diferencia de update_job_as_technician). Misma tabla de transiciones de un paso -- nunca permite saltos arbitrarios como new->completed. new<->scheduled sigue siendo exclusivo de schedule_job.';

revoke all on function advance_job_status(uuid, text) from public;
grant execute on function advance_job_status(uuid, text) to authenticated;
