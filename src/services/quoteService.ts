import type { Quote, QuoteStatus, RejectionReason, PublicQuoteView } from '../types';
import { supabase } from '../lib/supabase';
import {
  quoteRowToDomain,
  quoteItemDomainToRpcInput,
  publicQuoteRowToView,
} from './mappers/quoteMapper';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

/**
 * quoteService: tercer patrón real sobre Supabase (tras Clients y
 * Opportunities) -- mismo contrato ServiceResult<T>/RLS/mapper, pero
 * con una diferencia estructural importante: las mutaciones que crean
 * o reestructuran Quote+QuoteItems NUNCA hacen inserts sueltos desde
 * el frontend. Pasan por RPC transaccional (create_quote_from_opportunity,
 * create_quote, update_quote_draft, create_job_draft -- ver migraciones
 * 005 y 006), porque un Quote sin items, o items huérfanos de un Quote
 * a medio crear, es un estado inconsistente que ninguna capa de
 * aplicación debería poder producir. Las lecturas y las transiciones
 * de estado simples (sendQuote, markAccepted, etc. -- un solo UPDATE
 * sobre una fila ya existente) sí usan queries directas, protegidas
 * por RLS como el resto de la app.
 */

// ---------- Cálculo de totales (solo para UX inmediata en el formulario) ----------

/**
 * Estos dos cálculos existen ÚNICAMENTE para que el formulario muestre
 * un total en pantalla mientras el usuario edita, antes de guardar.
 * NUNCA se envían subtotal/discount/tax/total calculados aquí como
 * autoridad: create_quote/create_quote_from_opportunity/update_quote_draft
 * recalculan todo en SQL a partir de los items crudos -- el valor que
 * termina persistido es siempre el que la RPC calculó, no el que este
 * archivo o el componente de React hayan mostrado en pantalla.
 */
export function calculateItemSubtotal(quantity: number, unitPrice: number, discount = 0): number {
  return Math.max(0, quantity * unitPrice - discount);
}

export function calculateQuoteTotals(
  items: { subtotal: number }[],
  discount: number,
  tax: number
): { subtotal: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = Math.max(0, subtotal - discount + tax);
  return { subtotal, total };
}

// ---------- Lecturas (multi-tenant, queries directas protegidas por RLS) ----------

export async function getQuotes(companyId: string): Promise<ServiceResult<Quote[]>> {
  try {
    const { data: quoteRows, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (quotesError) return fail(mapSupabaseError(quotesError));
    if (quoteRows.length === 0) return ok([]);

    const quoteIds = quoteRows.map((q) => q.id);
    const { data: itemRows, error: itemsError } = await supabase
      .from('quote_items')
      .select('*')
      .in('quote_id', quoteIds)
      .order('sort_order', { ascending: true });

    if (itemsError) return fail(mapSupabaseError(itemsError));

    const itemsByQuoteId = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const list = itemsByQuoteId.get(item.quote_id) ?? [];
      list.push(item);
      itemsByQuoteId.set(item.quote_id, list);
    }

    return ok(quoteRows.map((row) => quoteRowToDomain(row, itemsByQuoteId.get(row.id) ?? [])));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Requiere companyId explícito y lo aplica como filtro -- defensa
 * adicional además de RLS (política `quotes_select`), mismo patrón que
 * clientService/opportunityService.
 */
export async function getQuoteById(companyId: string, id: string): Promise<ServiceResult<Quote>> {
  try {
    const { data: quoteRow, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (quoteError) return fail(mapSupabaseError(quoteError));
    if (!quoteRow) return fail({ kind: 'not_found', message: 'No encontramos esa cotización.' });

    const { data: itemRows, error: itemsError } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', id)
      .order('sort_order', { ascending: true });

    if (itemsError) return fail(mapSupabaseError(itemsError));

    return ok(quoteRowToDomain(quoteRow, itemRows));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function getQuotesByClient(
  companyId: string,
  clientId: string
): Promise<ServiceResult<Quote[]>> {
  try {
    const { data: quoteRows, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .eq('company_id', companyId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (quotesError) return fail(mapSupabaseError(quotesError));
    if (quoteRows.length === 0) return ok([]);

    const quoteIds = quoteRows.map((q) => q.id);
    const { data: itemRows, error: itemsError } = await supabase
      .from('quote_items')
      .select('*')
      .in('quote_id', quoteIds)
      .order('sort_order', { ascending: true });

    if (itemsError) return fail(mapSupabaseError(itemsError));

    const itemsByQuoteId = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const list = itemsByQuoteId.get(item.quote_id) ?? [];
      list.push(item);
      itemsByQuoteId.set(item.quote_id, list);
    }

    return ok(quoteRows.map((row) => quoteRowToDomain(row, itemsByQuoteId.get(row.id) ?? [])));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ---------- Vista pública (sin sesión, vía RPC) ----------

/**
 * Único punto de lectura para la ruta pública /q/:publicToken. NO usa
 * companyId, NO requiere sesión, NO consulta `clients`/`companies`
 * directamente -- todo lo resuelve get_public_quote_by_token del lado
 * del servidor (SECURITY DEFINER), devolviendo únicamente los campos
 * que PublicQuoteView declara. Ver migración 005 para el contrato SQL.
 */
export async function getPublicQuoteByToken(
  publicToken: string
): Promise<ServiceResult<PublicQuoteView>> {
  try {
    const { data, error } = await supabase.rpc('get_public_quote_by_token', {
      p_public_token: publicToken,
    });

    if (error) return fail(mapSupabaseError(error));
    if (!data || data.length === 0) {
      return fail({ kind: 'not_found', message: 'Esta cotización no existe o el enlace no es válido.' });
    }

    return ok(publicQuoteRowToView(data[0]));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ---------- Estado derivado ----------

/** "expired" se calcula dinámicamente -- no se persiste como transición de estado (mismo criterio en la RPC pública, ver quoteMapper.publicQuoteRowToView). */
export function getEffectiveStatus(quote: Quote): QuoteStatus {
  const isPastExpiration = new Date(quote.expirationDate) < new Date();
  if (isPastExpiration && (quote.status === 'sent' || quote.status === 'viewed')) {
    return 'expired';
  }
  return quote.status;
}

export function isQuoteEditable(quote: Quote): boolean {
  return quote.status === 'draft';
}

/**
 * Reglas de transición administrativas -- idénticas a las ya auditadas
 * en Fase 2 (localDb). markAcceptedManually/markRejectedManually
 * permiten corregirse entre sí (accepted <-> rejected) como corrección
 * administrativa deliberada; sendQuote solo tiene sentido desde draft.
 * Estas reglas se revalidan en el UPDATE mismo vía `.eq('status', ...)`
 * -- si la fila no está en un estado permitido, el UPDATE no afecta
 * ninguna fila y el resultado es `not_found`/sin cambios, nunca una
 * transición inválida silenciosa.
 */
const ADMIN_TRANSITION_RULES: Record<'send' | 'markAccepted' | 'markRejected', QuoteStatus[]> = {
  send: ['draft'],
  markAccepted: ['sent', 'viewed', 'rejected'],
  markRejected: ['sent', 'viewed', 'accepted'],
};

// ---------- Creación (SIEMPRE vía RPC transaccional) ----------

export interface QuoteItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface CreateQuoteFromOpportunityInput {
  opportunityId: string;
  items: QuoteItemInput[];
  discount?: number;
  tax?: number;
  notes?: string;
  expirationDate?: string;
}

/**
 * Crea una Quote a partir de una Opportunity, de forma atómica:
 * create_quote_from_opportunity valida la oportunidad, genera número y
 * token seguros, crea Quote + QuoteItems, recalcula totales en SQL, y
 * marca la Opportunity como converted -- todo en una sola transacción
 * de servidor. El frontend nunca hace un insert de Quote y luego otro
 * de items por separado, ni marca converted por su cuenta.
 */
export async function createQuoteFromOpportunity(
  companyId: string,
  input: CreateQuoteFromOpportunityInput
): Promise<ServiceResult<Quote>> {
  try {
    const { data: quoteId, error: rpcError } = await supabase.rpc('create_quote_from_opportunity', {
      p_opportunity_id: input.opportunityId,
      p_items: input.items.map(quoteItemDomainToRpcInput),
      p_discount: input.discount ?? 0,
      p_tax: input.tax ?? 0,
      p_notes: input.notes ?? null,
      p_expiration_date: input.expirationDate ?? null,
    });

    if (rpcError) return fail(mapSupabaseError(rpcError));
    return getQuoteById(companyId, quoteId);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export interface CreateQuoteInput {
  clientId: string;
  items: QuoteItemInput[];
  discount?: number;
  tax?: number;
  notes?: string;
  expirationDate?: string;
}

/**
 * Crea una Quote manual (sin Opportunity de origen), vía create_quote.
 * companyId NUNCA se envía como parámetro de decisión: la RPC lo
 * deriva del cliente real (clients.company_id) y valida la membresía
 * del usuario autenticado sobre esa empresa -- el companyId que este
 * servicio recibe se usa solo para la lectura posterior (getQuoteById),
 * no para decidir a qué empresa pertenece la cotización creada.
 */
export async function createQuote(
  companyId: string,
  input: CreateQuoteInput
): Promise<ServiceResult<Quote>> {
  try {
    const { data: quoteId, error: rpcError } = await supabase.rpc('create_quote', {
      p_client_id: input.clientId,
      p_items: input.items.map(quoteItemDomainToRpcInput),
      p_discount: input.discount ?? 0,
      p_tax: input.tax ?? 0,
      p_notes: input.notes ?? null,
      p_expiration_date: input.expirationDate ?? null,
    });

    if (rpcError) return fail(mapSupabaseError(rpcError));
    return getQuoteById(companyId, quoteId);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ---------- Edición (SIEMPRE vía RPC transaccional, solo status = draft) ----------

export interface UpdateQuoteInput {
  clientId?: string;
  items?: QuoteItemInput[];
  discount?: number;
  tax?: number;
  notes?: string;
  expirationDate?: string;
}

/**
 * Edita una Quote en borrador vía update_quote_draft, que revalida
 * `status = draft` en SQL antes de tocar nada -- si la cotización ya
 * fue enviada, vista, aceptada, rechazada o cancelada, la RPC lanza una
 * excepción explícita (mapeada aquí a un ServiceError claro) y no
 * modifica ni la Quote ni sus items.
 */
export async function updateQuote(
  companyId: string,
  id: string,
  input: UpdateQuoteInput
): Promise<ServiceResult<Quote>> {
  try {
    const { error: rpcError } = await supabase.rpc('update_quote_draft', {
      p_quote_id: id,
      p_client_id: input.clientId ?? null,
      p_items: input.items ? input.items.map(quoteItemDomainToRpcInput) : null,
      p_discount: input.discount ?? null,
      p_tax: input.tax ?? null,
      p_notes: input.notes ?? null,
      p_expiration_date: input.expirationDate ?? null,
    });

    if (rpcError) return fail(mapSupabaseError(rpcError));
    return getQuoteById(companyId, id);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ---------- Duplicar / cancelar ----------

/**
 * Duplicar sigue siendo "crear una Quote nueva a partir de los datos
 * de otra" -- reutiliza createQuote (RPC transaccional), nunca copia
 * filas directamente. La copia no hereda opportunityId (mismo criterio
 * ya auditado en Fase 2: una duplicada es una cotización manual nueva).
 */
export async function duplicateQuote(companyId: string, id: string): Promise<ServiceResult<Quote>> {
  const original = await getQuoteById(companyId, id);
  if (original.error) return original;

  return createQuote(companyId, {
    clientId: original.data.clientId,
    items: original.data.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
    })),
    discount: original.data.discount,
    tax: original.data.tax,
    notes: original.data.notes,
  });
}

/** Solo cancela borradores -- una vez enviada, "cancelar" se maneja como rechazo manual. Query directa: un solo UPDATE condicionado, sin reestructurar items. */
export async function cancelQuote(companyId: string, id: string): Promise<ServiceResult<Quote>> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'cancelled' satisfies QuoteStatus })
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('status', 'draft')
      .select()
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) {
      return fail({
        kind: 'forbidden',
        message: 'Solo se pueden cancelar cotizaciones en borrador.',
      });
    }
    return getQuoteById(companyId, id);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ---------- Transiciones de estado (administrativas, query directa) ----------

/**
 * sendQuote: draft -> sent, guarda sent_at. Distinta de
 * resendQuoteLink: enviar por primera vez SÍ transiciona estado;
 * reenviar el enlace (cotización ya sent/viewed) NO lo hace -- ver
 * resendQuoteLink más abajo.
 *
 * La condición `.eq('status', 'draft')` en la propia query es la
 * revalidación de la regla de transición: si la fila no está en draft,
 * el UPDATE no afecta ninguna fila (`data` viene null) y se devuelve
 * `forbidden` en vez de aplicar una transición inválida.
 */
export async function sendQuote(companyId: string, id: string): Promise<ServiceResult<Quote>> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'sent' satisfies QuoteStatus, sent_at: now })
      .eq('id', id)
      .eq('company_id', companyId)
      .in('status', ADMIN_TRANSITION_RULES.send)
      .select()
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) {
      return fail({ kind: 'forbidden', message: 'Solo se pueden enviar cotizaciones en borrador.' });
    }
    return getQuoteById(companyId, id);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * resendQuoteLink: NO cambia status ni sent_at -- la cotización ya está
 * sent/viewed y el enlace público (publicToken) es el mismo de
 * siempre. Esta función solo existe para dejar explícito en el código
 * que "reenviar" es una operación de lectura (recuperar el enlace),
 * nunca una transición de estado -- evita que alguien reintroduzca por
 * error una llamada a sendQuote en el flujo de "reenviar por WhatsApp".
 */
export async function resendQuoteLink(companyId: string, id: string): Promise<ServiceResult<Quote>> {
  return getQuoteById(companyId, id);
}

export async function markAcceptedManually(companyId: string, id: string): Promise<ServiceResult<Quote>> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'accepted' satisfies QuoteStatus, accepted_at: now })
      .eq('id', id)
      .eq('company_id', companyId)
      .in('status', ADMIN_TRANSITION_RULES.markAccepted)
      .select()
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) {
      return fail({
        kind: 'forbidden',
        message: 'No se puede marcar como aceptada esta cotización desde su estado actual.',
      });
    }
    return getQuoteById(companyId, id);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function markRejectedManually(companyId: string, id: string): Promise<ServiceResult<Quote>> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'rejected' satisfies QuoteStatus, rejected_at: now })
      .eq('id', id)
      .eq('company_id', companyId)
      .in('status', ADMIN_TRANSITION_RULES.markRejected)
      .select()
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) {
      return fail({
        kind: 'forbidden',
        message: 'No se puede marcar como rechazada esta cotización desde su estado actual.',
      });
    }
    return getQuoteById(companyId, id);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ---------- Transiciones de estado (cliente, vía token público, SIEMPRE por RPC) ----------
//
// La UI pública NO es autoridad: estas tres funciones son wrappers
// delgados sobre las RPC mark_public_quote_viewed/accept_public_quote/
// reject_public_quote (SECURITY DEFINER, revalidan estado en SQL). Si
// la RPC devuelve false, este servicio NUNCA asume éxito -- vuelve a
// pedir el estado real por token para que la UI refleje lo que
// verdaderamente pasó.

export async function markViewedByToken(publicToken: string): Promise<ServiceResult<PublicQuoteView>> {
  try {
    const { error: rpcError } = await supabase.rpc('mark_public_quote_viewed', {
      p_public_token: publicToken,
    });
    // No se ramifica sobre el boolean devuelto: true/false solo indica
    // si HUBO transición (sent -> viewed), no si el token es válido --
    // en ambos casos la siguiente lectura (abajo) es la fuente de
    // verdad de lo que la UI debe mostrar.
    if (rpcError) return fail(mapSupabaseError(rpcError));
    return getPublicQuoteByToken(publicToken);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function acceptQuoteByToken(publicToken: string): Promise<ServiceResult<PublicQuoteView>> {
  try {
    const { error: rpcError } = await supabase.rpc('accept_public_quote', {
      p_public_token: publicToken,
    });
    if (rpcError) return fail(mapSupabaseError(rpcError));
    return getPublicQuoteByToken(publicToken);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function rejectQuoteByToken(
  publicToken: string,
  reason?: RejectionReason
): Promise<ServiceResult<PublicQuoteView>> {
  try {
    const { error: rpcError } = await supabase.rpc('reject_public_quote', {
      p_public_token: publicToken,
      p_reason: reason ?? null,
    });
    if (rpcError) return fail(mapSupabaseError(rpcError));
    return getPublicQuoteByToken(publicToken);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ---------- Filtros locales (en memoria, puro, sin red) ----------

export type QuoteFilter = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected';

export function filterQuotes(quotes: Quote[], filter: QuoteFilter): Quote[] {
  if (filter === 'all') return quotes;
  if (filter === 'sent') {
    return quotes.filter((q) => q.status === 'sent' || q.status === 'viewed');
  }
  return quotes.filter((q) => q.status === filter);
}

export function searchQuotesLocal(
  quotes: Quote[],
  query: string,
  clientNameById: Record<string, string>
): Quote[] {
  if (!query.trim()) return quotes;
  const q = query.toLowerCase();
  return quotes.filter(
    (quote) =>
      quote.quoteNumber.toLowerCase().includes(q) ||
      (clientNameById[quote.clientId] ?? '').toLowerCase().includes(q)
  );
}
