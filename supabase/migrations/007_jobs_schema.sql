-- 007_jobs_schema.sql
--
-- Fase 3, Bloque 1: esquema de Jobs (Órdenes de Trabajo) + fotos +
-- materiales, con RLS básico para owner/office. El acceso específico
-- de technician (solo sus propios Jobs asignados) se añade en el
-- Bloque 2 (008_technician_auth_and_rls.sql) -- no se diseña a medias
-- aquí. Storage (fotos reales) es el Bloque 5, no esta migración.
--
-- Refleja el tipo de dominio Job ya usado en la UI desde Fase 1 (ver
-- src/types/jobs.ts): mismo status enum, misma noción de fotos por
-- etapa (before/during/after) y materiales.
--
-- Principio de integridad multiempresa aplicado de forma exhaustiva:
-- CADA relación de jobs hacia otra tabla de negocio (client, quote,
-- job_draft, técnico asignado) usa una FK COMPUESTA que incluye
-- company_id, nunca una FK simple sobre el id solo. Esto hace
-- estructuralmente imposible que un Job de la Empresa A referencie un
-- Client/Quote/JobDraft/técnico de la Empresa B, incluso si un bug
-- futuro de frontend o de una RPC intentara insertarlo -- Postgres lo
-- rechaza a nivel de esquema, no solo por convención del código.

-- ============================================================
-- UNIQUE(id, company_id) en tablas existentes -- requisito previo
-- para que las FK compuestas de jobs (más abajo) puedan referenciarlas.
-- Seguro de aplicar sobre datos existentes: como `id` ya es único por
-- sí solo (PK), agregar company_id a un unique compuesto no puede
-- fallar por duplicados en ningún escenario.
-- ============================================================

alter table clients
  add constraint clients_id_company_id_unique unique (id, company_id);

alter table quotes
  add constraint quotes_id_company_id_unique unique (id, company_id);

alter table job_drafts
  add constraint job_drafts_id_company_id_unique unique (id, company_id);

-- ============================================================
-- JOBS
-- ============================================================

create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null,
  quote_id uuid,
  job_draft_id uuid,
  assigned_technician_id uuid,
  service_type text not null,
  status text not null default 'new'
    check (status in ('new', 'scheduled', 'en_route', 'in_progress', 'paused', 'completed', 'cancelled')),
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  address text,
  maps_url text,
  notes text,
  total numeric(12, 2),
  paid_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Clave única compuesta (id, company_id): habilita que job_photos/
  -- job_materials referencien jobs con una FK compuesta -- ver esas
  -- tablas más abajo.
  constraint jobs_id_company_id_unique unique (id, company_id),

  -- Cliente: RESTRICT, no CASCADE -- un Job es un registro histórico
  -- de negocio (con su propio total, fechas, evidencia). Borrar un
  -- cliente NUNCA debe arrastrar en cascada la eliminación silenciosa
  -- de sus Jobs pasados; Postgres debe rechazar ese DELETE mientras
  -- existan Jobs asociados, obligando a una decisión explícita
  -- (reasignar el histórico, o archivar) antes de poder borrar el
  -- cliente. Hoy no existe ningún flujo de "eliminar cliente" en la
  -- UI real, así que este RESTRICT no bloquea nada existente.
  constraint jobs_client_same_company
    foreign key (client_id, company_id)
    references clients(id, company_id)
    on delete restrict,

  -- Quote: SET NULL -- la Quote de origen es informativa/histórica
  -- ("de qué cotización nació este trabajo"). El Job ya tiene su
  -- propio total copiado y es un registro operativo independiente una
  -- vez creado; si algún día se permite eliminar una Quote, el Job no
  -- debe bloquear ni desaparecer por eso -- simplemente pierde esa
  -- referencia. quote_id sigue siendo nullable (un Job manual, sin
  -- Quote de origen, es válido).
  constraint jobs_quote_same_company
    foreign key (quote_id, company_id)
    references quotes(id, company_id)
    on delete set null,

  -- JobDraft: mismo razonamiento que Quote -- puramente informativo,
  -- nunca debe bloquear ni arrastrar el Job real. Nullable.
  constraint jobs_job_draft_same_company
    foreign key (job_draft_id, company_id)
    references job_drafts(id, company_id)
    on delete set null,

  -- Técnico asignado: debe pertenecer a la MISMA empresa del Job.
  -- Nullable-safe (si assigned_technician_id es null, la FK no se
  -- evalúa -- comportamiento estándar de Postgres: una FK con
  -- cualquier columna en null se considera automáticamente
  -- satisfecha). NO valida role='technician' -- Postgres no puede
  -- expresar esa condición adicional dentro de una FK simple; esa
  -- verificación se hace en la RPC de asignación del Bloque 3.
  constraint jobs_technician_same_company
    foreign key (company_id, assigned_technician_id)
    references company_members(company_id, user_id),

  -- Montos nunca negativos.
  constraint jobs_total_non_negative check (total is null or total >= 0),
  constraint jobs_paid_amount_non_negative check (paid_amount is null or paid_amount >= 0),

  -- Calendario: si ambos extremos están presentes, el fin no puede
  -- preceder al inicio. Cualquiera de los dos puede faltar (Job sin
  -- programar, o programado solo con hora de inicio estimada).
  constraint jobs_schedule_order check (
    scheduled_end_at is null
    or scheduled_start_at is null
    or scheduled_end_at >= scheduled_start_at
  )
);

comment on table jobs is
  'Órdenes de trabajo reales (Fase 3). Toda relación hacia otra tabla de negocio (client, quote, job_draft, técnico) usa FK compuesta incluyendo company_id -- imposible referenciar una entidad de otra empresa, incluso ante un bug de aplicación.';

comment on constraint jobs_client_same_company on jobs is
  'RESTRICT: borrar un cliente con Jobs asociados falla explícitamente -- nunca se pierde histórico de Jobs por accidente al borrar un cliente.';

comment on constraint jobs_quote_same_company on jobs is
  'SET NULL: la Quote de origen es informativa. El Job sigue existiendo con su propio total si la Quote se elimina algún día.';

comment on constraint jobs_job_draft_same_company on jobs is
  'SET NULL: mismo criterio que jobs_quote_same_company -- referencia histórica, nunca bloqueante.';

comment on constraint jobs_technician_same_company on jobs is
  'Garantiza que el técnico asignado pertenezca a la misma empresa del Job. Efecto secundario a tener en cuenta: mientras un Job referencie a un miembro por esta FK, Postgres bloqueará el DELETE de esa fila de company_members -- "quitar a un técnico de la empresa" (bloques futuros de gestión de equipo) necesitará primero reasignar o desasignar (assigned_technician_id = null) sus Jobs, no un DELETE directo de la membresía.';

comment on column jobs.job_draft_id is
  'Referencia informativa al borrador de origen (si lo hubo) -- no hay lógica de consumir el draft; simplemente queda como historial de que este Job nació de esa conversión.';

comment on column jobs.scheduled_start_at is
  'timestamptz (no date+time separados): permite duración real, y sirve directamente para las vistas de calendario día/semana/mes sin combinar dos columnas en el frontend.';

comment on column jobs.scheduled_end_at is
  'Opcional -- un Job puede tener solo scheduled_start_at (hora estimada de inicio) sin duración conocida todavía.';

create trigger trg_jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- ============================================================
-- JOB_PHOTOS
-- ============================================================
--
-- Solo la fila de metadata vive aquí -- el archivo real de la foto se
-- sube a Supabase Storage en el Bloque 5 de esta fase, y
-- storage_path guarda la referencia a ese archivo. No se diseña el
-- bucket ni sus políticas todavía.

create table job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  company_id uuid not null references companies(id) on delete cascade,
  stage text not null check (stage in ('before', 'during', 'after')),
  storage_path text not null,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- FK compuesta hacia jobs(id, company_id): impide declarar una foto
  -- con un company_id distinto al de su Job real.
  constraint job_photos_job_company_fk
    foreign key (job_id, company_id)
    references jobs(id, company_id)
    on delete cascade
);

comment on table job_photos is
  'Metadata de fotos de evidencia por Job. storage_path apunta a un objeto en Supabase Storage (bucket a definir en el Bloque 5 de Fase 3) -- esta tabla NO almacena el archivo en sí.';

comment on column job_photos.company_id is
  'Denormalizado desde jobs.company_id a propósito: permite que la policy RLS de esta tabla filtre directamente por company_id sin un subquery a jobs en cada fila. La FK compuesta job_photos_job_company_fk garantiza que este valor nunca pueda divergir del company_id real del job_id referenciado.';

-- ============================================================
-- JOB_MATERIALS
-- ============================================================

create table job_materials (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  quantity numeric(12, 2) not null default 1,
  unit text,
  created_at timestamptz not null default now(),

  constraint job_materials_job_company_fk
    foreign key (job_id, company_id)
    references jobs(id, company_id)
    on delete cascade
);

comment on column job_materials.company_id is
  'Denormalizado desde jobs.company_id -- mismo criterio y misma garantía por FK compuesta que job_photos.company_id, ver ese comentario.';

-- ============================================================
-- RLS -- básico owner/office. technician se añade en el Bloque 2.
-- ============================================================

alter table jobs enable row level security;

create policy jobs_select_admin on jobs
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy jobs_insert_admin on jobs
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy jobs_update_admin on jobs
  for update
  using (has_role_in_company(company_id, array['owner', 'office']))
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy jobs_delete_admin on jobs
  for delete
  using (has_role_in_company(company_id, array['owner']));

alter table job_photos enable row level security;

create policy job_photos_select_admin on job_photos
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy job_photos_insert_admin on job_photos
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy job_photos_delete_admin on job_photos
  for delete
  using (has_role_in_company(company_id, array['owner', 'office']));

alter table job_materials enable row level security;

create policy job_materials_select_admin on job_materials
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy job_materials_insert_admin on job_materials
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy job_materials_update_admin on job_materials
  for update
  using (has_role_in_company(company_id, array['owner', 'office']))
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy job_materials_delete_admin on job_materials
  for delete
  using (has_role_in_company(company_id, array['owner', 'office']));

-- ============================================================
-- ÍNDICES
-- ============================================================

create index idx_jobs_company_id on jobs(company_id);
create index idx_jobs_client_id on jobs(client_id);
create index idx_jobs_assigned_technician_id on jobs(assigned_technician_id);
create index idx_jobs_scheduled_start_at on jobs(company_id, scheduled_start_at);
create index idx_job_photos_job_id on job_photos(job_id);
create index idx_job_materials_job_id on job_materials(job_id);
