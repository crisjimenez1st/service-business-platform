-- 002_rls.sql
--
-- Activa Row Level Security en todas las tablas de negocio y define
-- las políticas de acceso multiempresa. Ninguna tabla queda con RLS
-- desactivado; el acceso público a cotizaciones (Fase G) se resuelve
-- con funciones SECURITY DEFINER en 005_quote_public_functions.sql,
-- NUNCA desactivando RLS de `quotes`.
--
-- Principio de autorización (repetido en toda política): un usuario
-- puede operar sobre una fila de la empresa X si y solo si existe una
-- fila en company_members con:
--   user_id = auth.uid()  AND  company_id = X  AND  status = 'active'
-- El companyId que el frontend envíe en una query NUNCA es, por sí
-- solo, motivo de acceso -- Postgres siempre re-evalúa esta condición
-- contra company_members, sin importar qué pida el cliente.

-- ============================================================
-- FUNCIONES HELPER: is_active_member / has_role_in_company
-- ============================================================
--
-- ⚠️ DECISIÓN CRÍTICA DE DISEÑO — RECURSIÓN DE RLS:
--
-- Estas funciones consultan company_members, y company_members TIENE
-- su propia RLS activa (ver más abajo, sección COMPANY_MEMBERS). Si
-- estas funciones fueran SECURITY INVOKER (como en un primer borrador
-- de esta migración), correrían con los permisos de quien llama a la
-- policy — es decir, el propio usuario cuya query disparó la
-- evaluación de RLS. Eso significa que su SELECT interno a
-- company_members volvería a evaluar la policy de SELECT de
-- company_members, la cual (para permitir "ver a los compañeros de
-- equipo") también depende de is_active_member(company_id) — la misma
-- función que se está evaluando. Postgres entra en un ciclo y aborta
-- con "infinite recursion detected in policy for relation
-- company_members". Y como CUALQUIER política de CUALQUIER tabla
-- (clients, quotes, etc.) llama a estas mismas funciones, ese ciclo no
-- se limita a queries sobre company_members: rompería el acceso a
-- toda la aplicación.
--
-- SOLUCIÓN: declarar estas funciones SECURITY DEFINER. Al ejecutarse
-- con los privilegios de su dueño (el rol que aplicó las migraciones,
-- típicamente con bypass de RLS a nivel de tabla) en vez de los
-- privilegios de quien invoca la policy, su SELECT interno a
-- company_members NO vuelve a pasar por la política RLS de esa tabla
-- -- rompe el ciclo por diseño. Esto es el patrón estándar y
-- documentado de Supabase para funciones de autorización usadas
-- dentro de policies ("security definer functions to bypass RLS
-- recursion").
--
-- Mitigación del riesgo que introduce SECURITY DEFINER (acceso sin
-- restricción de RLS): estas funciones:
--   - Devuelven ÚNICAMENTE un boolean — nunca una fila, nunca datos.
--   - Tienen el mínimo de parámetros necesarios (uuid, uuid[]/text[]),
--     ningún parámetro de tipo "query libre" que pudiera inyectarse.
--   - SET search_path = public fijo y explícito (evita que alguien
--     manipule el search_path de la sesión para redirigir a qué
--     tabla "company_members" apunta realmente).
--   - Referencian la tabla completamente calificada como
--     public.company_members, no solo "company_members", para no
--     depender de que el search_path resuelva correctamente ni
--     siquiera en el caso de que alguien lograra alterarlo.
--   - REVOKE ALL FROM PUBLIC + GRANT EXECUTE solo a los roles que
--     realmente las necesitan (authenticated; no "anon", que nunca
--     tiene fila propia en company_members y siempre evaluaría false).

create or replace function is_active_member(p_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

comment on function is_active_member is
  'True si auth.uid() es miembro ACTIVO de la empresa dada. SECURITY DEFINER deliberado: evita recursión infinita de RLS al ser llamada desde la propia policy de SELECT de company_members (ver comentario extenso arriba). Devuelve solo boolean, nunca filas.';

revoke all on function is_active_member(uuid) from public;
grant execute on function is_active_member(uuid) to authenticated;

create or replace function has_role_in_company(p_company_id uuid, p_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.role = any(p_roles)
  );
$$;

comment on function has_role_in_company is
  'True si auth.uid() es miembro ACTIVO de la empresa con uno de los roles dados. SECURITY DEFINER por el mismo motivo que is_active_member — ver comentario arriba.';

revoke all on function has_role_in_company(uuid, text[]) from public;
grant execute on function has_role_in_company(uuid, text[]) to authenticated;

-- ============================================================
-- COMPANIES
-- ============================================================

alter table companies enable row level security;

create policy companies_select on companies
  for select
  using (is_active_member(id));

create policy companies_update on companies
  for update
  using (has_role_in_company(id, array['owner']))
  with check (has_role_in_company(id, array['owner']));

-- No hay policy de INSERT directo: las empresas se crean únicamente
-- vía create_company_for_current_user() (004), que corre como
-- SECURITY DEFINER y evita que cualquiera cree una empresa y se
-- declare miembro de cualquier otra por su cuenta.
-- No hay policy de DELETE: eliminar una empresa queda fuera de
-- alcance de Fase 2.5.

-- ============================================================
-- PROFILES
-- ============================================================

alter table profiles enable row level security;

create policy profiles_select_own on profiles
  for select
  using (id = auth.uid());

create policy profiles_update_own on profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_insert_own on profiles
  for insert
  with check (id = auth.uid());

-- ============================================================
-- COMPANY_MEMBERS
-- ============================================================

alter table company_members enable row level security;

-- Ver membresías de empresas donde el propio usuario es miembro activo
-- (así puede ver a sus compañeros, no solo su propia fila).
create policy company_members_select on company_members
  for select
  using (is_active_member(company_id));

-- Solo owner gestiona membresías. Sin policy de INSERT genérica: la
-- primera membresía (owner) se crea vía create_company_for_current_user
-- (004); invitar empleados adicionales queda fuera de alcance de
-- Fase 2.5 (ver deuda técnica en README).
create policy company_members_update on company_members
  for update
  using (has_role_in_company(company_id, array['owner']))
  with check (has_role_in_company(company_id, array['owner']));

-- ============================================================
-- CLIENTS
-- ============================================================

alter table clients enable row level security;

create policy clients_select on clients
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy clients_insert on clients
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy clients_update on clients
  for update
  using (has_role_in_company(company_id, array['owner', 'office']))
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy clients_delete on clients
  for delete
  using (has_role_in_company(company_id, array['owner']));

-- ============================================================
-- EQUIPMENT
-- ============================================================

alter table equipment enable row level security;

create policy equipment_select on equipment
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy equipment_insert on equipment
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy equipment_update on equipment
  for update
  using (has_role_in_company(company_id, array['owner', 'office']))
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy equipment_delete on equipment
  for delete
  using (has_role_in_company(company_id, array['owner']));

-- ============================================================
-- OPPORTUNITIES
-- ============================================================

alter table opportunities enable row level security;

create policy opportunities_select on opportunities
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy opportunities_insert on opportunities
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy opportunities_update on opportunities
  for update
  using (has_role_in_company(company_id, array['owner', 'office']))
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy opportunities_delete on opportunities
  for delete
  using (has_role_in_company(company_id, array['owner']));

-- ============================================================
-- QUOTES
-- ============================================================

alter table quotes enable row level security;

-- RLS permanece activo SIEMPRE en esta tabla. El acceso público por
-- token (Fase G) se resuelve con funciones SECURITY DEFINER
-- (005_quote_public_functions.sql) que corren con los permisos del
-- dueño de la función, no del rol "anon" sujeto a estas políticas. El
-- usuario anónimo NUNCA hace SELECT directo sobre `quotes` — solo a
-- través de esas funciones controladas.

create policy quotes_select on quotes
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy quotes_insert on quotes
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy quotes_update on quotes
  for update
  using (has_role_in_company(company_id, array['owner', 'office']))
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy quotes_delete on quotes
  for delete
  using (has_role_in_company(company_id, array['owner']));

-- ============================================================
-- QUOTE_ITEMS
-- ============================================================

alter table quote_items enable row level security;

-- quote_items no tiene company_id propio: hereda la regla de acceso
-- de su cotización padre vía subquery.
create policy quote_items_select on quote_items
  for select
  using (
    exists (
      select 1 from quotes q
      where q.id = quote_items.quote_id
        and has_role_in_company(q.company_id, array['owner', 'office'])
    )
  );

create policy quote_items_insert on quote_items
  for insert
  with check (
    exists (
      select 1 from quotes q
      where q.id = quote_items.quote_id
        and has_role_in_company(q.company_id, array['owner', 'office'])
    )
  );

create policy quote_items_update on quote_items
  for update
  using (
    exists (
      select 1 from quotes q
      where q.id = quote_items.quote_id
        and has_role_in_company(q.company_id, array['owner', 'office'])
    )
  )
  with check (
    exists (
      select 1 from quotes q
      where q.id = quote_items.quote_id
        and has_role_in_company(q.company_id, array['owner', 'office'])
    )
  );

create policy quote_items_delete on quote_items
  for delete
  using (
    exists (
      select 1 from quotes q
      where q.id = quote_items.quote_id
        and has_role_in_company(q.company_id, array['owner', 'office'])
    )
  );

-- ============================================================
-- JOB_DRAFTS
-- ============================================================

alter table job_drafts enable row level security;

create policy job_drafts_select on job_drafts
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

create policy job_drafts_insert on job_drafts
  for insert
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy job_drafts_update on job_drafts
  for update
  using (has_role_in_company(company_id, array['owner', 'office']))
  with check (has_role_in_company(company_id, array['owner', 'office']));

create policy job_drafts_delete on job_drafts
  for delete
  using (has_role_in_company(company_id, array['owner']));

-- ============================================================
-- ACTIVITY_LOG
-- ============================================================

alter table activity_log enable row level security;

create policy activity_log_select on activity_log
  for select
  using (has_role_in_company(company_id, array['owner', 'office']));

-- Sin policy de insert/update/delete para usuarios normales: los
-- eventos se insertan desde funciones SECURITY DEFINER o triggers
-- internos, nunca directamente desde el cliente.

-- ============================================================
-- NOTA SOBRE TECHNICIAN
-- ============================================================
--
-- El rol 'technician' queda deliberadamente SIN acceso a clients,
-- equipment, opportunities, quotes, quote_items ni job_drafts en esta
-- fase (todas las políticas de arriba excluyen 'technician' de las
-- listas de roles permitidos). Fase 3 (Órdenes de Trabajo, interfaz de
-- técnico) definirá qué necesita ver un técnico (sus trabajos
-- asignados) y se agregarán políticas específicas en ese momento — no
-- antes, para no sobre-diseñar permisos sobre un módulo inexistente.
