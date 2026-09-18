-- 009_job_draft_conversion.sql
--
-- Fase 3, Bloque 3: conversión JobDraft -> Job real, asignación de
-- técnico, y programación. Tres RPCs transaccionales, todas exigiendo
-- owner/office activo de la empresa correspondiente:
--   create_job_from_job_draft -- conversión idempotente
--   assign_job_technician     -- asignar/reasignar/desasignar
--   schedule_job              -- única autoridad de scheduled_start_at/
--                                scheduled_end_at y la transición
--                                new <-> scheduled

-- ============================================================
-- A. Nueva columna: jobs.description
-- ============================================================
--
-- Separada de jobs.notes a propósito: description es el contexto/
-- instrucciones ORIGINALES del trabajo (copiado una sola vez desde
-- job_drafts.description en el momento de creación); notes es
-- información operativa MUTABLE que el técnico va añadiendo después
-- (vía update_job_as_technician, Bloque 2) -- mezclarlas perdería la
-- descripción original en cuanto el técnico escribiera su primera
-- nota.

alter table jobs add column description text;

comment on column jobs.description is
  'Contexto/instrucciones originales del trabajo, copiado una sola vez desde job_drafts.description al crear el Job (create_job_from_job_draft) o provisto directamente si el Job se crea manualmente. Nunca se sobrescribe automáticamente después -- distinto de notes, que es mutable y operativo (ver update_job_as_technician, migración 008).';

-- ============================================================
-- B. Idempotencia: UNIQUE(job_draft_id)
-- ============================================================
--
-- job_draft_id es nullable (Jobs creados manualmente, sin draft de
-- origen, son válidos) -- un UNIQUE sobre columna nullable en Postgres
-- permite múltiples NULL sin conflicto (NULL nunca iguala a NULL en la
-- comparación de unicidad), así que esto no afecta Jobs manuales y sí
-- garantiza que un job_draft_id no-nulo nunca aparezca dos veces.

alter table jobs add constraint jobs_job_draft_id_unique unique (job_draft_id);

-- ============================================================
-- C. RPC: create_job_from_job_draft
-- ============================================================
--
-- Única forma de convertir un JobDraft en un Job real. Idempotente:
-- una segunda llamada con el mismo job_draft_id devuelve el Job ya
-- creado en vez de duplicar. Siempre crea con status='new' y sin
-- programación -- schedule_job es la única autoridad de
-- scheduled_start_at/scheduled_end_at/transición a 'scheduled' (ver
-- RPC más abajo), así que este parámetro no existe aquí.

create or replace function create_job_from_job_draft(
  p_job_draft_id uuid,
  p_assigned_technician_id uuid default null
)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.job_drafts%rowtype;
  v_existing_job_id uuid;
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  -- Bloquea el draft real antes de decidir nada -- evita que dos
  -- llamadas concurrentes (doble clic) lean el mismo estado y ambas
  -- intenten crear un Job.
  select * into v_draft
  from public.job_drafts jd
  where jd.id = p_job_draft_id
  for update;

  if not found then
    raise exception 'Borrador de trabajo no encontrado: %', p_job_draft_id;
  end if;

  if not has_role_in_company(v_draft.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para convertir este borrador en un trabajo';
  end if;

  -- Idempotencia: si ya existe un Job para este draft, se devuelve tal
  -- cual -- ninguna otra validación ni escritura ocurre. Este es el
  -- camino normal ante un doble clic; la constraint UNIQUE de abajo es
  -- la red de seguridad para el caso de condición de carrera real
  -- entre este SELECT y el INSERT.
  select j.id into v_existing_job_id
  from public.jobs j
  where j.job_draft_id = p_job_draft_id;

  if v_existing_job_id is not null then
    select * into v_job from public.jobs j where j.id = v_existing_job_id;
    return v_job;
  end if;

  -- Validación del técnico (si se proporciona uno en la creación):
  -- misma empresa del draft, role=technician, status=active. Falla
  -- explícitamente si no cumple -- nunca se crea un Job con un técnico
  -- inválido asignado.
  if p_assigned_technician_id is not null then
    if not exists (
      select 1 from public.company_members cm
      where cm.company_id = v_draft.company_id
        and cm.user_id = p_assigned_technician_id
        and cm.role = 'technician'
        and cm.status = 'active'
    ) then
      raise exception 'El técnico indicado no pertenece a esta empresa, no tiene rol de técnico, o no está activo';
    end if;
  end if;

  begin
    insert into public.jobs (
      company_id, client_id, quote_id, job_draft_id, assigned_technician_id,
      service_type, description, notes, status,
      scheduled_start_at, scheduled_end_at, total
    )
    values (
      v_draft.company_id, v_draft.client_id, v_draft.quote_id, v_draft.id, p_assigned_technician_id,
      v_draft.title, v_draft.description, null, 'new',
      null, null, v_draft.estimated_total
    )
    returning * into v_job;
  exception
    when unique_violation then
      -- Condición de carrera real: otra transacción ganó entre el
      -- SELECT de idempotencia de arriba y este INSERT. En vez de
      -- propagar el error, se re-consulta y se devuelve el Job que
      -- ganó la carrera -- mismo comportamiento observable que el
      -- camino normal de idempotencia.
      select * into v_job
      from public.jobs j
      where j.job_draft_id = p_job_draft_id;
  end;

  return v_job;
end;
$$;

comment on function create_job_from_job_draft is
  'Convierte un JobDraft en un Job real, de forma idempotente (UNIQUE(job_draft_id) + re-consulta ante condición de carrera). Siempre crea con status=new, sin programación -- schedule_job es la única autoridad de fechas/transición a scheduled. Copia description desde el draft; notes nace NULL.';

revoke all on function create_job_from_job_draft(uuid, uuid) from public;
grant execute on function create_job_from_job_draft(uuid, uuid) to authenticated;

-- ============================================================
-- D. RPC: assign_job_technician
-- ============================================================
--
-- Asigna, reasigna o desasigna (p_technician_id = null) el técnico de
-- un Job. Permitido en new/scheduled/en_route/in_progress/paused
-- (incluye in_progress deliberadamente -- puede existir un handoff
-- operativo real). Rechazado en completed/cancelled -- el histórico de
-- quién hizo un trabajo ya finalizado no debe alterarse.

create or replace function assign_job_technician(
  p_job_id uuid,
  p_technician_id uuid default null
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
    raise exception 'No autorizado para reasignar este trabajo';
  end if;

  if v_job.status in ('completed', 'cancelled') then
    raise exception 'No se puede cambiar el técnico de un trabajo % -- el histórico de un trabajo finalizado no se modifica', v_job.status;
  end if;

  if p_technician_id is not null then
    if not exists (
      select 1 from public.company_members cm
      where cm.company_id = v_job.company_id
        and cm.user_id = p_technician_id
        and cm.role = 'technician'
        and cm.status = 'active'
    ) then
      raise exception 'El técnico indicado no pertenece a esta empresa, no tiene rol de técnico, o no está activo';
    end if;
  end if;

  update public.jobs j
  set assigned_technician_id = p_technician_id
  where j.id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function assign_job_technician is
  'Asigna/reasigna/desasigna (p_technician_id=null) el técnico de un Job. Permitido en new/scheduled/en_route/in_progress/paused; rechazado en completed/cancelled para preservar el histórico. Valida misma empresa + role=technician + status=active cuando se asigna un técnico no nulo. No modifica status.';

revoke all on function assign_job_technician(uuid, uuid) from public;
grant execute on function assign_job_technician(uuid, uuid) to authenticated;

-- ============================================================
-- E. RPC: schedule_job
-- ============================================================
--
-- Única autoridad de scheduled_start_at/scheduled_end_at y de la
-- transición new <-> scheduled. Programar (p_scheduled_start_at no
-- nulo) desde new -> scheduled; reprogramar desde scheduled se queda
-- en scheduled. Desprogramar (p_scheduled_start_at nulo, señal
-- explícita de limpiar) desde scheduled -> new; desde new es no-op.
-- Rechazado por completo (ni fechas ni status cambian) si el Job está
-- en en_route/in_progress/paused/completed/cancelled -- ya entró en su
-- ciclo operativo.

create or replace function schedule_job(
  p_job_id uuid,
  p_scheduled_start_at timestamptz default null,
  p_scheduled_end_at timestamptz default null
)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_new_status text;
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
    raise exception 'No autorizado para programar este trabajo';
  end if;

  if v_job.status not in ('new', 'scheduled') then
    raise exception 'No se puede (re)programar un trabajo en estado % -- ya entró en su ciclo operativo', v_job.status;
  end if;

  -- Validación explícita del orden de fechas antes de tocar la fila,
  -- para dar un mensaje claro en vez de depender solo del CHECK crudo
  -- de la tabla (jobs_schedule_order, migración 007).
  if p_scheduled_start_at is not null
     and p_scheduled_end_at is not null
     and p_scheduled_end_at < p_scheduled_start_at then
    raise exception 'La fecha de fin no puede ser anterior a la fecha de inicio';
  end if;

  if p_scheduled_start_at is not null then
    -- Programar o reprogramar: new -> scheduled, o scheduled se queda
    -- scheduled con las fechas actualizadas.
    v_new_status := 'scheduled';
  else
    -- Señal explícita de desprogramar: scheduled -> new. Si ya estaba
    -- en new, esto es un no-op válido (limpiar una fecha ya limpia).
    v_new_status := 'new';
  end if;

  update public.jobs j
  set
    status = v_new_status,
    scheduled_start_at = p_scheduled_start_at,
    scheduled_end_at = case when p_scheduled_start_at is null then null else p_scheduled_end_at end
  where j.id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function schedule_job is
  'Única autoridad de scheduled_start_at/scheduled_end_at y de la transición new<->scheduled. p_scheduled_start_at no nulo programa (new->scheduled, o reprograma manteniendo scheduled); nulo desprograma (scheduled->new, o no-op si ya era new). Rechazado en en_route/in_progress/paused/completed/cancelled.';

revoke all on function schedule_job(uuid, timestamptz, timestamptz) from public;
grant execute on function schedule_job(uuid, timestamptz, timestamptz) to authenticated;

-- ============================================================
-- F. get_my_assigned_jobs -- ahora incluye description
-- ============================================================
--
-- El técnico necesita el contexto original del trabajo (qué debe
-- hacer), no solo notes (que puede seguir vacío si él mismo no ha
-- anotado nada todavía). DROP FUNCTION es obligatorio antes de
-- recrearla: Postgres no permite cambiar el shape de RETURNS TABLE de
-- una función existente vía CREATE OR REPLACE (error 42P13, confirmado
-- al ejecutar esta migración por primera vez) -- hay que eliminarla
-- primero. Es seguro: DROP + CREATE con el mismo nombre no pierde
-- nada, solo hay que re-otorgar GRANT/REVOKE después porque el DROP
-- los descarta junto con la función.

drop function if exists get_my_assigned_jobs();

create or replace function get_my_assigned_jobs()
returns table (
  id uuid,
  client_id uuid,
  client_name text,
  client_phone text,
  client_whatsapp text,
  service_type text,
  description text,
  status text,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  address text,
  maps_url text,
  notes text
)
language sql
security definer
volatile
set search_path = public
as $$
  select
    j.id,
    j.client_id,
    c.name as client_name,
    c.phone as client_phone,
    c.whatsapp as client_whatsapp,
    j.service_type,
    j.description,
    j.status,
    j.scheduled_start_at,
    j.scheduled_end_at,
    j.address,
    j.maps_url,
    j.notes
  from public.jobs j
  join public.clients c on c.id = j.client_id
  join public.company_members cm
    on cm.company_id = j.company_id
   and cm.user_id = auth.uid()
  where j.assigned_technician_id = auth.uid()
    and cm.status = 'active'
    and cm.role = 'technician'
  order by j.scheduled_start_at nulls last;
$$;

comment on function get_my_assigned_jobs is
  'Única vía de lectura de Jobs para un technician. Verifica explícitamente role=technician + status=active. Devuelve exclusivamente campos operativos, ahora incluyendo description (contexto original del trabajo) -- nunca total, paid_amount, quote_id, job_draft_id, company_id, ni datos administrativos del cliente. volatile: depende de auth.uid(), nunca debe marcarse stable/immutable.';

revoke all on function get_my_assigned_jobs() from public;
grant execute on function get_my_assigned_jobs() to authenticated;
