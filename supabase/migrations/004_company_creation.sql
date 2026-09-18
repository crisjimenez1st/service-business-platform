-- 004_company_creation.sql
--
-- RPC transaccional para el flujo de "primer usuario": registrarse,
-- crear su empresa, y quedar como owner -- sin que el frontend tenga
-- que hacer múltiples inserts inseguros.

create or replace function create_company_for_current_user(p_company_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_company_id uuid;
begin
  -- CRÍTICO: el id del usuario se obtiene de auth.uid() dentro de esta
  -- función (contexto de la sesión autenticada que invoca el RPC),
  -- NUNCA de un parámetro que el frontend pudiera enviar. Si se
  -- aceptara un p_user_id como argumento, cualquier usuario autenticado
  -- podría crear una membresía "owner" para OTRO usuario con solo
  -- conocer su uuid -- exactamente el tipo de vulnerabilidad que esta
  -- función existe para evitar.
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'No autenticado: se requiere una sesión activa para crear una empresa';
  end if;

  if p_company_name is null or length(trim(p_company_name)) = 0 then
    raise exception 'El nombre de la empresa es obligatorio';
  end if;

  if length(p_company_name) > 200 then
    raise exception 'El nombre de la empresa es demasiado largo';
  end if;

  -- Ambos inserts corren en la misma transacción implícita de la
  -- función: si el segundo falla, el primero se revierte
  -- automáticamente -- nunca queda una empresa huérfana sin miembro.
  -- Tablas calificadas explícitamente (public.companies,
  -- public.company_members) como defensa en profundidad adicional al
  -- SET search_path = public ya fijado arriba.
  insert into public.companies (name)
  values (trim(p_company_name))
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company_id, v_user_id, 'owner', 'active');

  return v_company_id;
end;
$$;

comment on function create_company_for_current_user is
  'Crea una empresa y asigna al usuario autenticado actual (auth.uid(), nunca un parámetro externo) como owner activo, de forma atómica.';

-- Revoca ejecución del público en general y la otorga solo a
-- authenticated -- un usuario anónimo (sin sesión) no puede invocar
-- esta función.
revoke all on function create_company_for_current_user(text) from public;
grant execute on function create_company_for_current_user(text) to authenticated;
