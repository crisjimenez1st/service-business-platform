-- 010_calendar_support.sql
--
-- Fase 3, Bloque 4 (soporte de esquema): agrega companies.timezone
-- (para que el calendario agrupe/presente fechas en la zona horaria
-- real de la empresa, no en UTC) y la RPC get_company_technicians()
-- (única vía segura para que owner/office vean nombres de técnicos --
-- profiles solo permite SELECT de la propia fila, ver 002_rls.sql, así
-- que ninguna consulta directa del frontend puede resolver esto).

-- ============================================================
-- A. companies.timezone
-- ============================================================
--
-- Nombre de zona IANA (no un offset fijo) -- soporta correctamente
-- cualquier cambio de horario de verano futuro, aunque Nicaragua no lo
-- use actualmente. Default 'America/Managua', apropiado para las
-- empresas existentes de ServiFlow Nicaragua (Seguridad ABC, Empresa
-- B) y para cualquier empresa nueva mientras no se ofrezca un
-- selector de timezone en el onboarding (fuera de alcance de este
-- bloque).

alter table companies add column timezone text not null default 'America/Managua';

comment on column companies.timezone is
  'Zona horaria IANA de la empresa (ej. America/Managua). Postgres sigue almacenando todos los timestamptz de jobs en UTC internamente -- esta columna solo determina cómo el frontend agrupa, presenta y construye fechas para el calendario (Mes/Semana/Día, agenda de técnico, formularios de programación). Nunca cambia el dato almacenado, solo su interpretación/presentación.';

-- ============================================================
-- B. RPC: get_company_technicians
-- ============================================================
--
-- Único camino seguro para que owner/office obtengan nombre/email de
-- los técnicos de su empresa. profiles solo tiene policy de SELECT
-- sobre la propia fila (id = auth.uid()) -- un admin no puede leer el
-- profile de otro usuario por SELECT directo, ni siquiera de su propia
-- empresa. Esta función SECURITY DEFINER resuelve eso sin exponer
-- auth.users directamente al cliente: solo devuelve user_id,
-- display_name (full_name si existe, si no el email de profiles, si
-- tampoco existe la fila en profiles cae al email de auth.users -- se
-- confirmó en el desarrollo de este bloque que profiles no tiene
-- trigger de auto-creación, así que puede estar vacía para usuarios
-- creados manualmente vía el dashboard de Supabase) y email.

create or replace function get_company_technicians(p_company_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text
)
language sql
security definer
volatile
set search_path = public
as $$
  select
    cm.user_id,
    coalesce(p.full_name, p.email, au.email) as display_name,
    coalesce(p.email, au.email) as email
  from public.company_members cm
  left join public.profiles p on p.id = cm.user_id
  left join auth.users au on au.id = cm.user_id
  where cm.company_id = p_company_id
    and cm.role = 'technician'
    and cm.status = 'active'
    and has_role_in_company(p_company_id, array['owner', 'office'])
  order by display_name nulls last;
$$;

comment on function get_company_technicians is
  'Único camino seguro para que owner/office vean nombre/email de los técnicos activos de su empresa (profiles solo permite SELECT de la propia fila). SECURITY DEFINER: el join a auth.users nunca se expone directamente al cliente -- solo email, ya conocido por el admin en su rol de gestión de equipo. has_role_in_company en el WHERE hace que la función devuelva 0 filas (no un error) si quien llama no es owner/office activo de esa empresa -- misma empresa exigida explícitamente vía p_company_id.';

revoke all on function get_company_technicians(uuid) from public;
grant execute on function get_company_technicians(uuid) to authenticated;
