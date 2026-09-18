import type { Opportunity, OpportunityStatus } from '../types';
import type { Database } from '../types/database.types';
import * as db from './localDb';
import { TABLES } from './tables';
import { supabase } from '../lib/supabase';
import {
  opportunityRowToDomain,
  opportunityDomainToInsertRow,
  type OpportunityDomainInput,
} from './mappers/opportunityMapper';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

/**
 * opportunityService: segundo patrón real sobre Supabase (tras
 * Clients) -- misma estructura: CRUD real con ServiceResult<T>, RLS
 * como única protección verdadera, mapper snake_case ↔ camelCase.
 *
 * "Crear cotización" desde una Oportunidad ya NO vive en este archivo:
 * ahora que Quotes está migrado, ese flujo completo (crear Quote +
 * QuoteItems + marcar la Opportunity como converted, todo atómico) lo
 * resuelve `quoteService.createQuoteFromOpportunity` llamando a la RPC
 * `create_quote_from_opportunity` (ver supabase/migrations/005) desde
 * `useOpportunityActions`. Este servicio nunca marca `converted` por
 * su cuenta -- ver nota al final del archivo, sección LEGACY.
 */

// ============================================================
// CRUD real -- migrado a Supabase
// ============================================================

export async function getOpportunities(companyId: string): Promise<ServiceResult<Opportunity[]>> {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('company_id', companyId)
      .order('due_date', { ascending: true });

    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(opportunityRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Requiere companyId explícito y lo aplica como filtro de la query --
 * mismo patrón defensivo que clientService.getClientById: la garantía
 * real de aislamiento es RLS (política `opportunities_select`), este
 * filtro solo hace que un id de otra empresa se vea como "no
 * encontrado" en vez de -en teoría, si RLS fallara- filtrar datos
 * ajenos silenciosamente.
 */
export async function getOpportunityById(
  companyId: string,
  id: string
): Promise<ServiceResult<Opportunity>> {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos esa oportunidad.' });
    return ok(opportunityRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function getOpportunitiesByClient(
  companyId: string,
  clientId: string
): Promise<ServiceResult<Opportunity[]>> {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('company_id', companyId)
      .eq('client_id', clientId)
      .order('due_date', { ascending: true });

    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(opportunityRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function createOpportunity(
  companyId: string,
  input: OpportunityDomainInput
): Promise<ServiceResult<Opportunity>> {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .insert(opportunityDomainToInsertRow(companyId, input))
      .select()
      .single();

    if (error) return fail(mapSupabaseError(error));
    return ok(opportunityRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function updateOpportunity(
  companyId: string,
  id: string,
  patch: Partial<OpportunityDomainInput>
): Promise<ServiceResult<Opportunity>> {
  try {
    const update: Database['public']['Tables']['opportunities']['Update'] = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.reason !== undefined) update.description = patch.reason;
    if (patch.estimatedValue !== undefined) update.estimated_value = patch.estimatedValue;
    if (patch.dueDate !== undefined) update.due_date = patch.dueDate;
    if (patch.category !== undefined) update.type = patch.category;

    const { data, error } = await supabase
      .from('opportunities')
      .update(update)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos esa oportunidad.' });
    return ok(opportunityRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * markContacted: status → contacted, last_contacted_at → now().
 * Comportamiento preservado exactamente del ya auditado en Fase 1/2:
 * NO elimina ni oculta la oportunidad de las listas -- isVisibleOpportunity
 * sigue considerando 'contacted' como vigente.
 */
export async function markContacted(
  companyId: string,
  id: string
): Promise<ServiceResult<Opportunity>> {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ status: 'contacted' satisfies OpportunityStatus, last_contacted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos esa oportunidad.' });
    return ok(opportunityRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * postponeOpportunity: status → postponed, due_date → newDate.
 * Cambio de comportamiento pedido explícitamente en esta migración: la
 * versión anterior sobre localDb dejaba status 'active' (ver
 * opportunityMapper.ts); ahora se persiste 'postponed' como estado
 * real. isVisibleOpportunity SÍ vuelve a mostrar una oportunidad
 * 'postponed' automáticamente en cuanto `due_date <= hoy` -- posponer
 * significa "recuérdamelo después", no "ocúltala para siempre". Antes
 * de llegar esa fecha, queda fuera de las listas inmediatas (ver
 * isVisibleOpportunity para el criterio exacto).
 */
export async function postponeOpportunity(
  companyId: string,
  id: string,
  newDate: string
): Promise<ServiceResult<Opportunity>> {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ status: 'postponed' satisfies OpportunityStatus, due_date: newDate })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos esa oportunidad.' });
    return ok(opportunityRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function discardOpportunity(
  companyId: string,
  id: string
): Promise<ServiceResult<Opportunity>> {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ status: 'discarded' satisfies OpportunityStatus })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos esa oportunidad.' });
    return ok(opportunityRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * ⚠️ markConverted (que marcaba la oportunidad como `converted` de
 * forma aislada) se eliminó de este servicio: ahora que Quotes está
 * migrado, marcar una Opportunity como converted SIN crear también su
 * Quote real en la misma transacción sería exactamente el estado
 * inconsistente que este código evitó deliberadamente durante el
 * bloque de Opportunities. La única forma correcta de convertir una
 * Opportunity es `quoteService.createQuoteFromOpportunity`, que llama
 * a la RPC `create_quote_from_opportunity` -- crea Quote + QuoteItems
 * y marca converted en una sola transacción de servidor. No reintroducir
 * un `markConverted` independiente en este archivo.
 */

// ============================================================
// Filtrado LOCAL (en memoria, puro, sin red) -- sin cambios de
// comportamiento respecto a Fase 1/2 salvo isVisibleOpportunity, que
// ahora trata 'postponed' según su due_date (ver criterio exacto
// debajo) -- antes ese status ni existía como valor real alcanzable.
// ============================================================

/**
 * "Vigente" = aparece en las listas activas/inmediatas del negocio:
 *   - 'active' y 'contacted' → siempre vigentes.
 *   - 'postponed' → vigente SOLO si `dueDate <= hoy`. Posponer
 *     significa "recuérdamelo después", no "ocúltalo para siempre" --
 *     cuando llega o pasa la fecha pospuesta, la oportunidad debe
 *     reaparecer en las listas inmediatas exactamente igual que una
 *     'active' cualquiera. Antes de esta corrección, 'postponed'
 *     quedaba oculta indefinidamente sin importar la fecha -- bug real
 *     corregido aquí.
 *   - 'discarded' y 'converted' → nunca vigentes, sin importar la fecha.
 * Única fuente de verdad para este criterio en toda la app -- si el
 * criterio cambia, se ajusta aquí una sola vez.
 */
export function isVisibleOpportunity(opportunity: Opportunity): boolean {
  if (opportunity.status === 'active' || opportunity.status === 'contacted') return true;
  if (opportunity.status === 'postponed') {
    return isDueDateTodayOrPast(opportunity.dueDate);
  }
  return false;
}

/** `dueDate` puede venir como fecha (YYYY-MM-DD) o datetime ISO -- se compara solo la parte de fecha, en hora local, para que "hoy" sea consistente con lo que el usuario ve en la UI. */
function isDueDateTodayOrPast(dueDate: string): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate.slice(0, 10) + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() <= today.getTime();
}

export function getTotalPotentialValue(opportunities: Opportunity[]): number {
  return opportunities.reduce((sum, o) => sum + o.estimatedValue, 0);
}

export type OpportunityFilter = 'all' | Opportunity['category'];

export function filterOpportunities(
  opportunities: Opportunity[],
  filter: OpportunityFilter
): Opportunity[] {
  if (filter === 'all') return opportunities;
  return opportunities.filter((o) => o.category === filter);
}

// ============================================================
// ⚠️ LEGACY / MOCK -- solo para datos demo mientras Jobs/Equipment
// sigan sin migrar. NO debe alimentar pantallas reales de
// Opportunities después de esta migración (ver seedOpportunities.ts).
// ============================================================

export function getOpportunitiesFromLocalMockOnly(companyId: string): Opportunity[] {
  return db.getAllForCompany<Opportunity>(TABLES.opportunities, companyId);
}
