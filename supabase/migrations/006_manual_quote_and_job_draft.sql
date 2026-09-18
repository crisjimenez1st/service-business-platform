-- 006_manual_quote_and_job_draft.sql
--
-- Tres funciones nuevas para cerrar el flujo de Quotes sin Opportunity
-- y el paso Quote aceptada -> JobDraft, ambas con las mismas garantías
-- transaccionales que create_quote_from_opportunity (005):
--   A. create_quote: creación manual (sin Opportunity), misma lógica
--      de numeración segura + items + totales recalculados en SQL.
--   B. update_quote_draft: edición transaccional de una Quote en
--      status 'draft' -- reemplaza items completos + recalcula
--      totales, todo o nada.
--   C. create_job_draft: idempotente por quote_id (aprovecha la
--      constraint unique de 001) -- si ya existe, lo devuelve; nunca
--      crea un segundo.

-- ============================================================
-- A. create_quote (manual, sin Opportunity)
-- ============================================================

create or replace function create_quote(
  p_client_id uuid,
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
  -- El companyId no llega como parámetro del frontend (mismo principio
  -- que create_company_for_current_user): se deriva del cliente real,
  -- y de paso esto verifica que el cliente exista.
  select company_id into v_company_id
  from public.clients
  where id = p_client_id;

  if v_company_id is null then
    raise exception 'Cliente no encontrado: %', p_client_id;
  end if;

  if not has_role_in_company(v_company_id, array['owner', 'office']) then
    raise exception 'No autorizado para crear cotizaciones en esta empresa';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La cotización debe tener al menos un ítem';
  end if;

  v_expiration := coalesce(p_expiration_date, (current_date + interval '15 days')::date);

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

  v_quote_number := next_quote_number(v_company_id);

  insert into public.quotes (
    company_id, client_id, opportunity_id, quote_number, status,
    expiration_date, notes, subtotal, discount, tax, total
  )
  values (
    v_company_id, p_client_id, null, v_quote_number, 'draft',
    v_expiration, p_notes, v_subtotal, coalesce(p_discount, 0), coalesce(p_tax, 0), v_total
  )
  returning id into v_quote_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_quantity := (v_item->>'quantity')::numeric;
    v_item_unit_price := (v_item->>'unit_price')::numeric;
    v_item_discount := coalesce((v_item->>'discount')::numeric, 0);
    v_item_subtotal := greatest(0, v_item_quantity * v_item_unit_price - v_item_discount);

    insert into public.quote_items (quote_id, description, quantity, unit_price, discount, subtotal)
    values (v_quote_id, v_item->>'description', v_item_quantity, v_item_unit_price, v_item_discount, v_item_subtotal);
  end loop;

  return v_quote_id;
end;
$$;

comment on function create_quote is
  'Crea una Quote manual (sin Opportunity de origen) + sus QuoteItems, en una sola transacción. companyId se deriva del cliente, nunca se acepta como parámetro directo del frontend.';

revoke all on function create_quote(uuid, jsonb, numeric, numeric, text, date) from public;
grant execute on function create_quote(uuid, jsonb, numeric, numeric, text, date) to authenticated;

-- ============================================================
-- B. update_quote_draft (edición transaccional, solo status = draft)
-- ============================================================

create or replace function update_quote_draft(
  p_quote_id uuid,
  p_client_id uuid default null,
  p_items jsonb default null,
  p_discount numeric default null,
  p_tax numeric default null,
  p_notes text default null,
  p_expiration_date date default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_subtotal numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_discount numeric(12, 2);
  v_tax numeric(12, 2);
  v_item jsonb;
  v_item_quantity numeric(12, 2);
  v_item_unit_price numeric(12, 2);
  v_item_discount numeric(12, 2);
  v_item_subtotal numeric(12, 2);
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'Cotización no encontrada: %', p_quote_id;
  end if;

  if not has_role_in_company(v_quote.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para editar esta cotización';
  end if;

  -- Regla ya auditada: solo se permite editar borradores. Igual que el
  -- resto de reglas de transición de esta app, se revalida aquí en SQL
  -- -- no basta con que el frontend oculte el botón "Editar".
  if v_quote.status <> 'draft' then
    raise exception 'Solo se pueden editar cotizaciones en borrador';
  end if;

  if p_client_id is not null then
    if not exists (
      select 1 from public.clients c
      where c.id = p_client_id and c.company_id = v_quote.company_id
    ) then
      raise exception 'El cliente indicado no pertenece a esta empresa';
    end if;
  end if;

  v_discount := coalesce(p_discount, v_quote.discount);
  v_tax := coalesce(p_tax, v_quote.tax);

  -- Si vienen items nuevos, se reemplaza el conjunto completo (delete +
  -- insert) dentro de la misma transacción -- nunca queda un estado a
  -- medias porque toda la función se revierte si cualquier paso falla.
  if p_items is not null then
    if jsonb_array_length(p_items) = 0 then
      raise exception 'La cotización debe tener al menos un ítem';
    end if;

    delete from public.quote_items where quote_id = p_quote_id;

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

      insert into public.quote_items (quote_id, description, quantity, unit_price, discount, subtotal)
      values (p_quote_id, v_item->>'description', v_item_quantity, v_item_unit_price, v_item_discount, v_item_subtotal);
    end loop;
  else
    select coalesce(sum(subtotal), 0) into v_subtotal
    from public.quote_items
    where quote_id = p_quote_id;
  end if;

  v_total := greatest(0, v_subtotal - v_discount + v_tax);

  update public.quotes
  set
    client_id = coalesce(p_client_id, client_id),
    subtotal = v_subtotal,
    discount = v_discount,
    tax = v_tax,
    total = v_total,
    notes = coalesce(p_notes, notes),
    expiration_date = coalesce(p_expiration_date, expiration_date)
  where id = p_quote_id;

  return true;
end;
$$;

comment on function update_quote_draft is
  'Edita una Quote en status draft de forma transaccional: reemplaza items (si se envían) y recalcula subtotal/total en SQL. Falla si la cotización no está en draft.';

revoke all on function update_quote_draft(uuid, uuid, jsonb, numeric, numeric, text, date) from public;
grant execute on function update_quote_draft(uuid, uuid, jsonb, numeric, numeric, text, date) to authenticated;

-- ============================================================
-- C. create_job_draft (idempotente por quote_id)
-- ============================================================

create or replace function create_job_draft(
  p_quote_id uuid,
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_existing_id uuid;
  v_job_draft_id uuid;
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id;

  if not found then
    raise exception 'Cotización no encontrada: %', p_quote_id;
  end if;

  if not has_role_in_company(v_quote.company_id, array['owner', 'office']) then
    raise exception 'No autorizado para preparar una orden de trabajo para esta cotización';
  end if;

  if v_quote.status <> 'accepted' then
    raise exception 'Solo se puede preparar una orden de trabajo desde una cotización aceptada';
  end if;

  -- Idempotencia real: si ya existe un job_draft para esta cotización,
  -- se devuelve su id sin crear uno nuevo -- protege contra doble-click
  -- y contra dos pestañas/dispositivos actuando sobre la misma
  -- cotización aceptada, apoyándose en la constraint unique(quote_id)
  -- de 001_initial_schema.sql como garantía de última instancia (si
  -- dos transacciones llegaran a competir, la segunda fallaría por la
  -- constraint y esta función simplemente re-consulta y devuelve la
  -- fila que ganó la carrera).
  select id into v_existing_id
  from public.job_drafts
  where quote_id = p_quote_id;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into public.job_drafts (company_id, quote_id, client_id, title, description, estimated_total)
  values (v_quote.company_id, p_quote_id, v_quote.client_id, p_title, p_description, v_quote.total)
  on conflict (quote_id) do nothing
  returning id into v_job_draft_id;

  if v_job_draft_id is null then
    select id into v_job_draft_id from public.job_drafts where quote_id = p_quote_id;
  end if;

  return v_job_draft_id;
end;
$$;

comment on function create_job_draft is
  'Crea un JobDraft desde una Quote aceptada, idempotente por quote_id (constraint unique + re-consulta si ya existe). Nunca crea un segundo JobDraft para la misma cotización.';

revoke all on function create_job_draft(uuid, text, text) from public;
grant execute on function create_job_draft(uuid, text, text) to authenticated;
