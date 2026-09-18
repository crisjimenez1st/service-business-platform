-- 005_quote_transactions_and_public_functions.sql
--
-- Dos grupos de funciones:
--   A. create_quote_from_opportunity: resuelve la deuda técnica
--      documentada desde Fase 1/2 (Oportunidad -> QuoteDraft -> Quote
--      encadenaba escrituras separadas). Ahora es una sola función
--      transaccional: si falla la creación de items o el update de la
--      oportunidad, TODO se revierte -- la oportunidad nunca queda
--      "converted" sin una cotización real detrás.
--   B. Las 4 funciones públicas que sirven la ruta /q/:publicToken sin
--      requerir sesión, sin desactivar RLS de quotes, y sin exponer
--      company_id ni client_id.
--
-- Todas las operaciones sensibles (insert/update/select sobre tablas
-- de negocio) califican explícitamente el esquema como public.<tabla>,
-- en vez de confiar únicamente en `SET search_path = public`. Es
-- defensa en profundidad: aunque el search_path fijo ya debería ser
-- suficiente, calificar explícitamente evita cualquier ambigüedad si
-- en el futuro existiera un esquema adicional con un objeto del mismo
-- nombre, o si alguien alterara el search_path por algún medio no
-- anticipado.

-- ============================================================
-- A. create_quote_from_opportunity
-- ============================================================

create or replace function create_quote_from_opportunity(
  p_opportunity_id uuid,
  p_items jsonb,
  p_discount numeric default 0,
  p_tax numeric default 0,
  p_notes text default null,
  p_expiration_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opportunity public.opportunities%rowtype;
  v_company_id uuid;
  v_quote_id uuid;
  v_quote_number text;
  v_subtotal numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_item jsonb;
  v_item_quantity numeric(12, 2);
  v_item_unit_price numeric(12, 2);
  v_item_discount numeric(12, 2);
  v_item_subtotal numeric(12, 2);
  v_expiration date;
begin
  -- 1. Cargar y bloquear la oportunidad. FOR UPDATE evita que dos
  -- llamadas concurrentes sobre la misma oportunidad ambas la crean
  -- "todavía activa" y generen dos cotizaciones para una sola.
  select * into v_opportunity
  from public.opportunities
  where id = p_opportunity_id
  for update;

  if not found then
    raise exception 'Oportunidad no encontrada: %', p_opportunity_id;
  end if;

  v_company_id := v_opportunity.company_id;

  if not has_role_in_company(v_company_id, array['owner', 'office']) then
    raise exception 'No autorizado para convertir esta oportunidad';
  end if;

  if v_opportunity.status = 'converted' then
    raise exception 'Esta oportunidad ya fue convertida a cotización';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La cotización debe tener al menos un ítem';
  end if;

  v_expiration := coalesce(p_expiration_date, (current_date + interval '15 days')::date);

  -- 2. Calcular subtotal a partir de los items (recalculado en SQL,
  -- nunca se confía en un total enviado desde el frontend).
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_quantity := (v_item->>'quantity')::numeric;
    v_item_unit_price := (v_item->>'unit_price')::numeric;
    v_item_discount := coalesce((v_item->>'discount')::numeric, 0);

    if v_item_quantity is null or v_item_quantity <= 0 then
      raise exception 'Cantidad inválida en un ítem de la cotización';
    end if;
    if v_item_unit_price is null or v_item_unit_price < 0 then
      raise exception 'Precio unitario inválido en un ítem de la cotización';
    end if;

    v_item_subtotal := greatest(0, v_item_quantity * v_item_unit_price - v_item_discount);
    v_subtotal := v_subtotal + v_item_subtotal;
  end loop;

  v_total := greatest(0, v_subtotal - coalesce(p_discount, 0) + coalesce(p_tax, 0));

  -- 3. Número de cotización (función segura con concurrencia de 003,
  -- dentro de esta misma transacción).
  v_quote_number := next_quote_number(v_company_id);

  -- 4. Insertar la cotización.
  insert into public.quotes (
    company_id, client_id, opportunity_id, quote_number, status,
    expiration_date, notes, subtotal, discount, tax, total
  )
  values (
    v_company_id, v_opportunity.client_id, p_opportunity_id, v_quote_number, 'draft',
    v_expiration, p_notes, v_subtotal, coalesce(p_discount, 0), coalesce(p_tax, 0), v_total
  )
  returning id into v_quote_id;

  -- 5. Insertar los items.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_quantity := (v_item->>'quantity')::numeric;
    v_item_unit_price := (v_item->>'unit_price')::numeric;
    v_item_discount := coalesce((v_item->>'discount')::numeric, 0);
    v_item_subtotal := greatest(0, v_item_quantity * v_item_unit_price - v_item_discount);

    insert into public.quote_items (quote_id, description, quantity, unit_price, discount, subtotal)
    values (v_quote_id, v_item->>'description', v_item_quantity, v_item_unit_price, v_item_discount, v_item_subtotal);
  end loop;

  -- 6. Marcar la oportunidad como convertida. Si CUALQUIER paso previo
  -- (o este) lanza una excepción, Postgres revierte TODA la función
  -- automáticamente -- no hace falta ROLLBACK explícito. Esta es la
  -- garantía que la deuda técnica de Fase 1/2 pedía: la oportunidad
  -- nunca queda "converted" sin una cotización real detrás.
  update public.opportunities
  set status = 'converted'
  where id = p_opportunity_id;

  return v_quote_id;
end;
$$;

comment on function create_quote_from_opportunity is
  'Crea una Quote + sus QuoteItems y marca la Opportunity como converted, todo en una sola transacción. Si cualquier paso falla, nada se aplica.';

revoke all on function create_quote_from_opportunity(uuid, jsonb, numeric, numeric, text, date) from public;
grant execute on function create_quote_from_opportunity(uuid, jsonb, numeric, numeric, text, date) to authenticated;

-- ============================================================
-- B. FUNCIONES PÚBLICAS (ruta /q/:publicToken, sin sesión)
-- ============================================================
--
-- Las 4 funciones siguientes son el ÚNICO camino por el que un
-- visitante sin sesión (rol "anon") puede leer o modificar una fila de
-- quotes. RLS de quotes permanece activo siempre (ver 002_rls.sql) --
-- estas funciones son SECURITY DEFINER, corren con los permisos de su
-- dueño y por eso SÍ pueden leer/escribir quotes aunque "anon" no
-- tendría permiso directo. Por eso cada una valida manualmente, dentro
-- de la función, todo lo que una policy de RLS validaría en una tabla
-- normal -- aquí no hay red de seguridad automática, la seguridad ES
-- el código de la función.

create or replace function get_public_quote_by_token(p_public_token uuid)
returns table (
  quote_number text,
  status text,
  issue_date date,
  expiration_date date,
  notes text,
  subtotal numeric,
  discount numeric,
  tax numeric,
  total numeric,
  currency text,
  client_name text,
  company_name text,
  company_logo_url text,
  company_phone text,
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Devuelve 0 filas (no una excepción) si el token no existe, para
  -- que "no encontrada" y "token inválido" se vean igual desde afuera
  -- -- no dar pistas de si un token existe a quien esté adivinando.
  return query
  select
    q.quote_number,
    q.status,
    q.issue_date,
    q.expiration_date,
    q.notes,
    q.subtotal,
    q.discount,
    q.tax,
    q.total,
    q.currency,
    c.name as client_name,
    co.name as company_name,
    co.logo_url as company_logo_url,
    co.phone as company_phone,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'description', qi.description,
            'quantity', qi.quantity,
            'unit_price', qi.unit_price,
            'discount', qi.discount,
            'subtotal', qi.subtotal
          )
          order by qi.sort_order, qi.created_at
        )
        from public.quote_items qi
        where qi.quote_id = q.id
      ),
      '[]'::jsonb
    ) as items
  from public.quotes q
  join public.clients c on c.id = q.client_id
  join public.companies co on co.id = q.company_id
  where q.public_token = p_public_token;
  -- Deliberadamente NO se seleccionan q.id, q.company_id, q.client_id
  -- ni ninguna otra columna interna: el contrato de esta función es
  -- exactamente "lo que el cliente final necesita ver", nada más.
end;
$$;

comment on function get_public_quote_by_token is
  'Lectura pública de una cotización por token, sin sesión. Devuelve únicamente los campos necesarios para mostrar el documento -- nunca company_id, client_id ni otra columna interna.';

revoke all on function get_public_quote_by_token(uuid) from public;
grant execute on function get_public_quote_by_token(uuid) to anon, authenticated;

create or replace function mark_public_quote_viewed(p_public_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
begin
  select * into v_quote
  from public.quotes
  where public_token = p_public_token
  for update;

  if not found then
    return false;
  end if;

  -- Regla exacta pedida: SOLO sent -> viewed. Cualquier otro estado
  -- base (incluido ya 'viewed') no se toca -- por esto reabrir el
  -- enlace nunca retrocede un estado más avanzado (accepted/rejected)
  -- a "viewed".
  if v_quote.status <> 'sent' then
    return false;
  end if;

  update public.quotes
  set status = 'viewed', viewed_at = now()
  where id = v_quote.id;

  return true;
end;
$$;

comment on function mark_public_quote_viewed is
  'Transiciona sent -> viewed la primera vez que el cliente abre /q/:publicToken. No hace nada (false) si el status no es exactamente sent.';

revoke all on function mark_public_quote_viewed(uuid) from public;
grant execute on function mark_public_quote_viewed(uuid) to anon, authenticated;

create or replace function accept_public_quote(p_public_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
begin
  select * into v_quote
  from public.quotes
  where public_token = p_public_token
  for update;

  if not found then
    return false;
  end if;

  -- Regla exacta pedida: solo sent/viewed, y no vencida. El vencimiento
  -- se evalúa aquí en SQL, no se confía en un "effective_status"
  -- calculado en el frontend -- un cliente podría manipular esa vista
  -- y llamar igual a esta función, así que se revalida por su cuenta.
  if v_quote.status not in ('sent', 'viewed') then
    return false;
  end if;

  if v_quote.expiration_date < current_date then
    return false;
  end if;

  update public.quotes
  set status = 'accepted', accepted_at = now()
  where id = v_quote.id;

  return true;
end;
$$;

comment on function accept_public_quote is
  'Acepta públicamente una cotización. Solo válido desde sent/viewed y con expiration_date >= hoy, revalidado en SQL.';

revoke all on function accept_public_quote(uuid) from public;
grant execute on function accept_public_quote(uuid) to anon, authenticated;

create or replace function reject_public_quote(p_public_token uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_allowed_reasons text[] := array['price', 'chose_another_provider', 'not_needed_now', 'wants_changes', 'other'];
begin
  select * into v_quote
  from public.quotes
  where public_token = p_public_token
  for update;

  if not found then
    return false;
  end if;

  if v_quote.status not in ('sent', 'viewed') then
    return false;
  end if;

  if v_quote.expiration_date < current_date then
    return false;
  end if;

  -- p_reason es opcional (spec: "no obligar a escribir") pero si viene
  -- un valor debe ser uno reconocido -- evita valores arbitrarios en
  -- una columna que la UI administrativa interpreta con un mapa fijo.
  if p_reason is not null and not (p_reason = any(v_allowed_reasons)) then
    raise exception 'Motivo de rechazo no reconocido: %', p_reason;
  end if;

  update public.quotes
  set status = 'rejected', rejected_at = now(), rejection_reason = p_reason
  where id = v_quote.id;

  return true;
end;
$$;

comment on function reject_public_quote is
  'Rechaza públicamente una cotización, con motivo opcional validado contra una lista fija. Mismas reglas de estado que accept_public_quote.';

revoke all on function reject_public_quote(uuid, text) from public;
grant execute on function reject_public_quote(uuid, text) to anon, authenticated;
