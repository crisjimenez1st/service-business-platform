-- 003_updated_at_and_quote_numbering.sql
--
-- Dos piezas relacionadas por necesidad (la tabla de secuencias de
-- numeración también necesita su propio updated_at):
--   1. Función genérica set_updated_at() + triggers en todas las
--      tablas con columna updated_at.
--   2. Numeración segura de cotizaciones (COT-0001, COT-0002...) sin
--      usar el patrón inseguro "SELECT MAX(...) + 1".

-- ============================================================
-- 1. set_updated_at() GENÉRICO
-- ============================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function set_updated_at is
  'Trigger genérico: fija updated_at = now() en cada UPDATE. Reutilizado por todas las tablas con esa columna.';

create trigger trg_companies_updated_at
  before update on companies
  for each row execute function set_updated_at();

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger trg_company_members_updated_at
  before update on company_members
  for each row execute function set_updated_at();

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

create trigger trg_equipment_updated_at
  before update on equipment
  for each row execute function set_updated_at();

create trigger trg_opportunities_updated_at
  before update on opportunities
  for each row execute function set_updated_at();

create trigger trg_quotes_updated_at
  before update on quotes
  for each row execute function set_updated_at();

create trigger trg_job_drafts_updated_at
  before update on job_drafts
  for each row execute function set_updated_at();

-- (quote_items y activity_log no tienen updated_at por diseño: los
-- ítems se reemplazan como conjunto al editar una cotización, y el log
-- de actividad es de solo-inserción -- ver 001_initial_schema.sql.)

-- ============================================================
-- 2. NUMERACIÓN SEGURA DE COTIZACIONES
-- ============================================================
--
-- Problema del patrón anterior (el que usaba el mock en localStorage):
--   SELECT MAX(numero) + 1 FROM quotes WHERE company_id = X
-- Bajo concurrencia real, dos transacciones pueden leer el mismo MAX
-- antes de que ninguna haga commit, y generar el mismo número -- una
-- condición de carrera clásica (race condition).
--
-- Solución: una tabla dedicada company_quote_sequences con una fila
-- por empresa y un contador entero, incrementado con una función que
-- hace UPDATE ... RETURNING dentro de una única transacción. El UPDATE
-- toma un bloqueo de fila implícito: Postgres serializa automáticamente
-- a cualquier segunda transacción que intente actualizar la misma
-- fila, haciéndola esperar hasta que la primera termine (commit o
-- rollback) antes de leer/incrementar el valor. Así nunca dos llamadas
-- concurrentes pueden obtener el mismo número.
--
-- Alternativa descartada: una SEQUENCE nativa de Postgres por empresa
-- (CREATE SEQUENCE dinámico por company_id) es igualmente segura pero
-- más incómoda operativamente (requiere crear/eliminar objetos SQL por
-- cada empresa nueva). Una tabla + UPDATE bloqueante logra la misma
-- garantía transaccional con un esquema fijo, más simple de mantener.

create table company_quote_sequences (
  company_id uuid primary key references companies(id) on delete cascade,
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table company_quote_sequences is
  'Contador de numeración de cotizaciones, una fila por empresa. Se incrementa exclusivamente vía next_quote_number() para ser seguro con concurrencia real.';

create trigger trg_company_quote_sequences_updated_at
  before update on company_quote_sequences
  for each row execute function set_updated_at();

-- RLS activo también en esta tabla, pero SIN ninguna policy permisiva:
-- ni siquiera SELECT. La spec de esta corrección es explícita — nadie
-- debe poder leer, insertar ni modificar este contador directamente,
-- solo a través de next_quote_number() (SECURITY DEFINER, definida
-- abajo). Con RLS activo y CERO policies, toda query directa de un
-- usuario normal (rol authenticated o anon) contra esta tabla devuelve
-- cero filas / falla, sin excepción alguna.
alter table company_quote_sequences enable row level security;

-- Sin policies de select/insert/update/delete para ningún rol de
-- aplicación: la única vía de lectura o escritura es next_quote_number(),
-- que la ejecuta como SECURITY DEFINER (bypassa RLS de esta tabla por
-- las mismas razones documentadas para is_active_member/
-- has_role_in_company más arriba).

-- Además de RLS, se revocan explícitamente los privilegios SQL de
-- tabla a nivel de rol -- doble candado: aunque alguien encontrara una
-- forma de sortear RLS (o Supabase cambiara su comportamiento por
-- defecto), estos roles no tienen ni el permiso base de SELECT/INSERT/
-- UPDATE sobre la tabla.
revoke all on company_quote_sequences from anon, authenticated;

create or replace function next_quote_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  -- Validación de input: aunque esta función normalmente se invoca
  -- solo desde create_quote_from_opportunity o el flujo de creación
  -- de cotización (ambos ya autorizados), se revalida aquí porque es
  -- SECURITY DEFINER -- nunca asumir que el caller ya fue autorizado
  -- en otra capa. Esta comprobación es también la que garantiza
  -- aislamiento entre empresas: un usuario de la empresa A que llame
  -- next_quote_number('<uuid de la empresa B>') recibe una excepción
  -- aquí mismo, sin leer ni incrementar ninguna fila de B.
  if not is_active_member(p_company_id) then
    raise exception 'No autorizado: no eres miembro activo de esta empresa';
  end if;

  -- Crea la fila de secuencia si es la primera cotización de la
  -- empresa; luego el UPDATE bloquea la fila (referenciando la tabla
  -- completamente calificada como public.company_quote_sequences,
  -- consistente con el resto de operaciones sensibles de esta
  -- migración) e incrementa en la misma transacción, garantizando que
  -- una segunda llamada concurrente espera hasta que esta transacción
  -- termine.
  insert into public.company_quote_sequences (company_id, last_number)
  values (p_company_id, 0)
  on conflict (company_id) do nothing;

  update public.company_quote_sequences
  set last_number = last_number + 1
  where company_id = p_company_id
  returning last_number into v_next;

  return 'COT-' || lpad(v_next::text, 4, '0');
end;
$$;

comment on function next_quote_number is
  'Genera el siguiente número de cotización (COT-0001, COT-0002...) de forma segura con concurrencia real. Nunca usar SELECT MAX(quote_number)+1. Único punto de acceso a company_quote_sequences.';

revoke all on function next_quote_number(uuid) from public;
grant execute on function next_quote_number(uuid) to authenticated;
