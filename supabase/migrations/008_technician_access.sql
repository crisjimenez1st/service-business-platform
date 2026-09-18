-- 008_technician_auth_and_rls.sql
--
-- Fase 3, Bloque 2: acceso real y limitado del rol technician.
--
-- Un técnico NO tiene tabla propia -- es un usuario de Supabase Auth
-- con una fila en company_members donde role = 'technician'.
--
-- ⚠️ DECISIÓN DE SEGURIDAD CLAVE: NO existe ninguna policy de SELECT
-- directo sobre `jobs` para technician. RLS filtra FILAS, no
-- COLUMNAS -- si a un técnico se le diera una policy de SELECT (aunque
-- fuera "solo sus propios Jobs"), el privilegio de tabla que
-- `authenticated` ya tiene sobre todas las columnas de `public.jobs`
-- le permitiría leer total/paid_amount/quote_id/job_draft_id con un
-- simple `select * from jobs`. Como el rol de Postgres `authenticated`
-- es compartido por owner/office/technician, no es posible resolver
-- esto con GRANT/REVOKE por columna -- la única forma estructuralmente
-- segura es que technician no tenga ningún camino de SELECT directo
-- sobre jobs/job_photos/job_materials en absoluto. Toda lectura pasa
-- por RPCs explícitas que declaran, columna por columna, qué exponen.
--
-- ⚠️ SEGUNDA TRAMPA DE RLS RESUELTA EN ESTA VERSIÓN: una policy de
-- job_photos/job_materials que hiciera `exists (select 1 from jobs j
-- where ...)` ejecutaría esa subconsulta con el RLS de `jobs` TAMBIÉN
-- activo para el mismo usuario -- y como no hay policy de SELECT sobre
-- jobs para technician, esa subconsulta devolvería 0 filas SIEMPRE,
-- incluso para un Job realmente asignado a él. La solución no es abrir
-- SELECT de jobs (rompería la protección de columnas de arriba): es
-- una función SECURITY DEFINER (can_current_technician_access_job)
-- que consulta jobs con los privilegios del DUEÑO de la función, no
-- los del caller -- mismo patrón ya usado por is_active_member/
-- has_role_in_company en 002_rls.sql para evitar la recursión RLS de
-- company_members. Las policies de INSERT usan este helper en vez de
-- un EXISTS directo contra jobs.
--
-- owner/office conservan exactamente sus policies actuales (007) --
-- este archivo no las toca.

-- ============================================================
-- A. Helper: can_current_technician_access_job
-- ============================================================
--
-- Único punto de verdad para "¿puede auth.uid() operar como técnico
-- sobre este Job?". Reutilizado por las policies de INSERT de
-- job_photos/job_materials y, para no duplicar la misma lógica de
-- autorización dos veces, también internamente por
-- update_job_as_technician en vez de repetir sus comprobaciones a
-- mano.

create or replace function can_current_technician_access_job(
  p_job_id uuid,
  p_company_id uuid
)
returns boolean
language sql
security definer
volatile -- correcto por diseño: depende de auth.uid(), que varía según qué sesión llama, así que nunca debe marcarse stable/immutable (eso autorizaría a Postgres a cachear su plan de ejecución entre llamadas de distintos usuarios). Un primer diagnóstico durante las pruebas del Bloque 2 atribuyó un resultado incorrecto a este motivo, pero la causa real resultó ser un token de sesión de navegador obsoleto en la prueba manual, no un bug de esta función -- se mantiene volatile de cualquier forma por ser la anotación correcta para una función con este patrón.
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs j
    join public.company_members cm
      on cm.company_id = j.company_id
     and cm.user_id = auth.uid()
    where j.id = p_job_id
      and j.company_id = p_company_id
      and j.assigned_technician_id = auth.uid()
      and cm.status = 'active'
      and cm.role = 'technician'
  );
$$;

comment on function can_current_technician_access_job is
  'SECURITY DEFINER a propósito: consulta jobs/company_members con los privilegios del dueño de la función, no del caller -- evita que el RLS de jobs (sin policy de SELECT para technician) haga que esta comprobación siempre devuelva falso. Verifica Job existente, company_id coincidente, asignación real, membresía activa Y role=technician específicamente (no basta con que assigned_technician_id coincida -- un Job jamás debería quedar asignado a alguien sin ese rol, pero esta función no confía en esa invariante y la revalida siempre).';

revoke all on function can_current_technician_access_job(uuid, uuid) from public;
grant execute on function can_current_technician_access_job(uuid, uuid) to authenticated;

-- ============================================================
-- B. RPC: get_my_assigned_jobs
-- ============================================================
--
-- Única vía de lectura de Jobs para un technician. Devuelve solo
-- campos operativos -- explícitamente excluidos: total, paid_amount,
-- quote_id, job_draft_id, assigned_technician_id, company_id. Del
-- cliente, solo name/phone/whatsapp -- nunca email, notas internas, ni
-- campos financieros.
--
-- Verifica role='technician' + status='active' directamente en el
-- WHERE (join a company_members) -- no delega en el helper de arriba
-- porque aquí no hay un p_job_id de entrada sobre el que preguntar
-- "¿puedo acceder a ESTE Job?"; en cambio filtra qué Jobs son
-- accesibles desde cero, que es una operación distinta.

create or replace function get_my_assigned_jobs()
returns table (
  id uuid,
  client_id uuid,
  client_name text,
  client_phone text,
  client_whatsapp text,
  service_type text,
  status text,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  address text,
  maps_url text,
  notes text
)
language sql
security definer
volatile -- correcto por diseño: depende de auth.uid(), que varía según qué sesión llama, así que nunca debe marcarse stable/immutable (eso autorizaría a Postgres a cachear su plan de ejecución entre llamadas de distintos usuarios). Un primer diagnóstico durante las pruebas del Bloque 2 atribuyó un resultado incorrecto a este motivo, pero la causa real resultó ser un token de sesión de navegador obsoleto en la prueba manual, no un bug de esta función -- se mantiene volatile de cualquier forma por ser la anotación correcta para una función con este patrón.
set search_path = public
as $$
  select
    j.id,
    j.client_id,
    c.name as client_name,
    c.phone as client_phone,
    c.whatsapp as client_whatsapp,
    j.service_type,
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
  'Única vía de lectura de Jobs para un technician. Verifica explícitamente role=technician + status=active (join a company_members), no solo que assigned_technician_id coincida con auth.uid(). Devuelve exclusivamente campos operativos: nunca total, paid_amount, quote_id, job_draft_id, company_id, ni datos administrativos del cliente.';

revoke all on function get_my_assigned_jobs() from public;
grant execute on function get_my_assigned_jobs() to authenticated;

-- ============================================================
-- C. RPC: get_my_job_photos / get_my_job_materials
-- ============================================================

create or replace function get_my_job_photos(p_job_id uuid)
returns table (
  id uuid,
  stage text,
  storage_path text,
  taken_at timestamptz
)
language sql
security definer
volatile -- correcto por diseño: depende de auth.uid(), que varía según qué sesión llama, así que nunca debe marcarse stable/immutable (eso autorizaría a Postgres a cachear su plan de ejecución entre llamadas de distintos usuarios). Un primer diagnóstico durante las pruebas del Bloque 2 atribuyó un resultado incorrecto a este motivo, pero la causa real resultó ser un token de sesión de navegador obsoleto en la prueba manual, no un bug de esta función -- se mantiene volatile de cualquier forma por ser la anotación correcta para una función con este patrón.
set search_path = public
as $$
  select p.id, p.stage, p.storage_path, p.taken_at
  from public.job_photos p
  join public.jobs j on j.id = p.job_id
  join public.company_members cm
    on cm.company_id = j.company_id
   and cm.user_id = auth.uid()
  where p.job_id = p_job_id
    and j.assigned_technician_id = auth.uid()
    and cm.status = 'active'
    and cm.role = 'technician';
$$;

comment on function get_my_job_photos is
  'Fotos de un Job propio del technician que llama. Verifica role=technician + status=active explícitamente, igual que get_my_assigned_jobs.';

revoke all on function get_my_job_photos(uuid) from public;
grant execute on function get_my_job_photos(uuid) to authenticated;

create or replace function get_my_job_materials(p_job_id uuid)
returns table (
  id uuid,
  name text,
  quantity numeric,
  unit text
)
language sql
security definer
volatile -- correcto por diseño: depende de auth.uid(), que varía según qué sesión llama, así que nunca debe marcarse stable/immutable (eso autorizaría a Postgres a cachear su plan de ejecución entre llamadas de distintos usuarios). Un primer diagnóstico durante las pruebas del Bloque 2 atribuyó un resultado incorrecto a este motivo, pero la causa real resultó ser un token de sesión de navegador obsoleto en la prueba manual, no un bug de esta función -- se mantiene volatile de cualquier forma por ser la anotación correcta para una función con este patrón.
set search_path = public
as $$
  select m.id, m.name, m.quantity, m.unit
  from public.job_materials m
  join public.jobs j on j.id = m.job_id
  join public.company_members cm
    on cm.company_id = j.company_id
   and cm.user_id = auth.uid()
  where m.job_id = p_job_id
    and j.assigned_technician_id = auth.uid()
    and cm.status = 'active'
    and cm.role = 'technician';
$$;

comment on function get_my_job_materials is
  'Materiales de un Job propio del technician que llama. Verifica role=technician + status=active explícitamente, igual que get_my_assigned_jobs.';

revoke all on function get_my_job_materials(uuid) from public;
grant execute on function get_my_job_materials(uuid) to authenticated;

-- ============================================================
-- D. JOB_PHOTOS / JOB_MATERIALS -- INSERT para technician
-- ============================================================
--
-- Usa can_current_technician_access_job (SECURITY DEFINER) en vez de
-- un EXISTS directo contra jobs -- ese EXISTS quedaría sujeto al RLS
-- de jobs para el caller y siempre devolvería falso, ver nota de
-- cabecera del archivo.

create policy job_photos_insert_technician on job_photos
  for insert
  with check (
    can_current_technician_access_job(job_photos.job_id, job_photos.company_id)
  );

comment on policy job_photos_insert_technician on job_photos is
  'Technician puede agregar fotos únicamente a Jobs asignados a sí mismo, vía can_current_technician_access_job (evita la trampa de RLS de un EXISTS directo contra jobs sin policy de SELECT). Sin SELECT directo (usar get_my_job_photos), ni UPDATE/DELETE. ⚠️ IMPORTANTE PARA EL CLIENTE QUE LLAME A ESTE INSERT: usar Prefer: return=minimal (default de supabase-js cuando la llamada NO encadena .select()) -- si se pide return=representation, PostgREST intenta un SELECT de la fila recién insertada como parte de la misma operación, y como no hay policy de SELECT para technician sobre job_photos, ese SELECT de retorno falla y PostgREST reporta el INSERT completo como rechazado por RLS (42501/403) aunque la fila sí quedó insertada -- confirmado en pruebas manuales del Bloque 2. Para confirmar la foto guardada, llamar a get_my_job_photos(p_job_id) en una petición separada.';

create policy job_materials_insert_technician on job_materials
  for insert
  with check (
    can_current_technician_access_job(job_materials.job_id, job_materials.company_id)
  );

comment on policy job_materials_insert_technician on job_materials is
  'Mismo criterio y mismo helper que job_photos_insert_technician -- ver ese comentario.';

-- ============================================================
-- E. RPC: update_job_as_technician
-- ============================================================
--
-- Único camino de escritura de un technician sobre un Job. Reutiliza
-- can_current_technician_access_job para la comprobación de acceso
-- (incluye ahora role=technician + status=active), en vez de repetir
-- esa lógica a mano por segunda vez en este archivo.
--
-- Devuelve únicamente (id, status, notes, updated_at) -- nunca la fila
-- completa: si devolviera `returns jobs` expondría total/paid_amount/
-- quote_id/job_draft_id en cada respuesta, aunque el técnico nunca
-- pudiera modificarlos -- la fuga de lectura sería igual de real
-- viniendo del valor de retorno.

create or replace function update_job_as_technician(
  p_job_id uuid,
  p_new_status text default null,
  p_notes text default null
)
returns table (
  id uuid,
  status text,
  notes text,
  updated_at timestamptz
)
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

  -- Bloquea la fila real antes de decidir nada -- evita que dos
  -- llamadas concurrentes sobre el mismo Job lean el mismo estado
  -- viejo y ambas crean que la transición es válida.
  --
  -- Las columnas de RETURNS TABLE (id, status, notes, updated_at) se
  -- vuelven variables implícitas dentro del cuerpo de esta función --
  -- por eso cada referencia a una columna de jobs con ese mismo
  -- nombre se califica explícitamente con el alias `j` en todo el
  -- cuerpo, para que Postgres nunca tenga que decidir entre "columna
  -- de jobs" y "variable de salida de la función" (error 42702, tal
  -- como ocurrió en una primera versión sin calificar).
  select * into v_job
  from public.jobs j
  where j.id = p_job_id
  for update;

  if not found then
    raise exception 'Job no encontrado: %', p_job_id;
  end if;

  -- Verificación de acceso centralizada: asignación real, membresía
  -- activa, y role=technician específicamente -- mismo helper que las
  -- policies de INSERT, sin duplicar la lógica una segunda vez.
  if not can_current_technician_access_job(v_job.id, v_job.company_id) then
    raise exception 'No autorizado: este Job no está asignado a tu usuario, o no eres un técnico activo de esta empresa';
  end if;

  -- Transición de estado: tabla fija, deliberadamente más estricta que
  -- lo que owner/office podrían hacer:
  --   scheduled   -> en_route
  --   en_route    -> in_progress
  --   in_progress -> paused
  --   in_progress -> completed
  --   paused      -> in_progress
  if p_new_status is not null then
    if not (
      (v_job.status = 'scheduled' and p_new_status = 'en_route')
      or (v_job.status = 'en_route' and p_new_status = 'in_progress')
      or (v_job.status = 'in_progress' and p_new_status = 'paused')
      or (v_job.status = 'in_progress' and p_new_status = 'completed')
      or (v_job.status = 'paused' and p_new_status = 'in_progress')
    ) then
      raise exception 'Transición de estado no permitida: % -> %', v_job.status, p_new_status;
    end if;
  end if;

  -- notes: reemplaza el campo completo (semántica actual, igual que el
  -- resto de la app). Historial de notas con autoría/fecha por
  -- entrada, o auditoría de cambios de estado, queda fuera de este
  -- bloque -- se resolvería con una tabla dedicada en una fase futura.
  update public.jobs j
  set
    status = coalesce(p_new_status, j.status),
    notes = coalesce(p_notes, j.notes)
  where j.id = p_job_id;

  return query
  select j.id, j.status, j.notes, j.updated_at
  from public.jobs j
  where j.id = p_job_id;
end;
$$;

comment on function update_job_as_technician is
  'Único camino de escritura de un technician sobre un Job: bloquea la fila con FOR UPDATE, verifica acceso vía can_current_technician_access_job (asignación real + membresía activa + role=technician), y valida la transición de estado contra una tabla fija. Solo permite modificar status y notes, y devuelve ÚNICAMENTE (id, status, notes, updated_at) -- nunca campos administrativos, ni siquiera de solo lectura en la respuesta.';

revoke all on function update_job_as_technician(uuid, text, text) from public;
grant execute on function update_job_as_technician(uuid, text, text) to authenticated;

-- ============================================================
-- F. PRIVILEGIOS DE TABLA -- explícitos, no dependientes del default
-- ============================================================
--
-- ⚠️ El rol de Postgres `authenticated` es COMPARTIDO por
-- owner/office/technician -- Postgres no puede otorgar un privilegio
-- de tabla distinto según el rol de NEGOCIO (eso vive en
-- company_members). Re-otorgar aquí no añade una restricción nueva
-- más allá de la que ya existía por default de plataforma --
-- owner/office siguen necesitando exactamente estos privilegios. Esta
-- sección deja la intención explícita en la migración en vez de
-- depender silenciosamente de un default que Supabase está retirando
-- (ver changelog "Tables not exposed to Data and GraphQL API
-- automatically"). La protección real contra technician sigue siendo,
-- en su totalidad, la ausencia de policy de SELECT/UPDATE/DELETE para
-- ese rol en jobs/job_photos/job_materials -- confirmado en las
-- pruebas manuales de este bloque.

revoke all on jobs from authenticated;
grant select, insert, update, delete on jobs to authenticated;

revoke all on job_photos from authenticated;
grant select, insert, delete on job_photos to authenticated;

revoke all on job_materials from authenticated;
grant select, insert, update, delete on job_materials to authenticated;
