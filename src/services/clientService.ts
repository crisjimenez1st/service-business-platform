import type { Equipment, Opportunity, Client } from '../types';
import * as db from './localDb';
import { TABLES } from './tables';
import { isVisibleOpportunity } from './opportunityService';
import { supabase } from '../lib/supabase';
import { clientRowToDomain, clientDomainToInsertRow, clientDomainToUpdateRow } from './mappers/clientMapper';
import type { ClientDomainInput } from './mappers/clientMapper';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

/**
 * clientService: única puerta de entrada a datos de clientes.
 * Los componentes NUNCA deben llamar a Supabase ni a localDb
 * directamente -- todo pasa por aquí.
 *
 * PATRÓN DE REFERENCIA para las siguientes entidades a migrar
 * (Opportunities, etc.): las funciones CRUD reales de Client
 * (getClients, getClientById, searchClients, createClient,
 * updateClient, deleteClient) ahora consultan Supabase y devuelven
 * `Promise<ServiceResult<T>>` -- nunca lanzan, nunca caen de vuelta a
 * localDb si Supabase falla (ver mapSupabaseError). El companyId que
 * recibe cada función se usa para construir la query (`.eq('company_id',
 * companyId)`), pero la protección real es RLS en el servidor: cada
 * política vuelve a validar la pertenencia del usuario autenticado vía
 * company_members, sin importar qué companyId pida el cliente.
 *
 * getClientEquipment y getClientJobs siguen sobre localDb -- dependen
 * de equipment/jobs, que todavía no se migran (Opportunities ya se
 * migró a Supabase; ver opportunityService.getOpportunitiesByClient
 * para la versión real, que reemplaza a las antiguas
 * getClientOpportunities/getNextOpportunityForClient de este archivo).
 * Quedan marcadas abajo para no confundirlas con el resto ya migrado.
 */

// ============================================================
// CRUD real -- migrado a Supabase
// ============================================================

export async function getClients(companyId: string): Promise<ServiceResult<Client[]>> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(clientRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Requiere companyId explícito y lo aplica como filtro de la query
 * (`.eq('company_id', companyId)`) -- esto es solo para que la UI
 * reciba `not_found` en vez de datos de otra empresa si alguien
 * manipulara un id en la URL, PERO la garantía real de que un cliente
 * de otra empresa nunca pueda leerse es RLS: aunque se omitiera este
 * filtro por error, la policy de `clients_select` igual bloquearía la
 * fila si el usuario autenticado no es miembro activo de esa empresa.
 */
export async function getClientById(id: string, companyId: string): Promise<ServiceResult<Client>> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) {
      return fail({ kind: 'not_found', message: 'No encontramos ese cliente.' });
    }
    return ok(clientRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Búsqueda en servidor (ILIKE, case-insensitive) por nombre o
 * teléfono. Distinta de `searchClientsLocal` (filtro en memoria sobre
 * una lista ya cargada, usada por ClientsPage junto a filterClients) --
 * esta función hace una query nueva cada vez, útil cuando la lista
 * completa de clientes no está ya en memoria.
 */
export async function searchClients(companyId: string, query: string): Promise<ServiceResult<Client[]>> {
  const trimmed = query.trim();
  if (!trimmed) return getClients(companyId);

  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
      .order('name', { ascending: true });

    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(clientRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function createClient(
  companyId: string,
  input: ClientDomainInput
): Promise<ServiceResult<Client>> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .insert(clientDomainToInsertRow(companyId, input))
      .select()
      .single();

    if (error) return fail(mapSupabaseError(error));
    return ok(clientRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function updateClient(
  id: string,
  companyId: string,
  patch: Partial<ClientDomainInput>
): Promise<ServiceResult<Client>> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .update(clientDomainToUpdateRow(patch))
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) {
      return fail({ kind: 'not_found', message: 'No encontramos ese cliente.' });
    }
    return ok(clientRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function deleteClient(id: string, companyId: string): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.from('clients').delete().eq('id', id).eq('company_id', companyId);

    if (error) return fail(mapSupabaseError(error));
    return ok(null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ============================================================
// Filtrado/búsqueda LOCAL (en memoria, sobre clientes ya cargados)
// -- sin cambios de comportamiento respecto a Fase 1/2, solo se
// mantienen aquí porque ClientsPage las sigue usando junto al
// resultado de getClients().
// ============================================================

export type ClientFilter =
  | 'all'
  | 'active'
  | 'with_balance'
  | 'with_opportunity'
  | 'maintenance_due'
  | 'warranty_due';

export function filterClients(
  clients: Client[],
  filter: ClientFilter,
  opportunities: Opportunity[]
): Client[] {
  switch (filter) {
    case 'with_balance':
      return clients.filter((c) => (c.pendingBalance ?? 0) > 0);
    case 'with_opportunity': {
      const clientIdsWithOpp = new Set(
        opportunities.filter(isVisibleOpportunity).map((o) => o.clientId)
      );
      return clients.filter((c) => clientIdsWithOpp.has(c.id));
    }
    case 'maintenance_due': {
      const today = new Date().toISOString().slice(0, 10);
      return clients.filter((c) => c.nextMaintenanceDate && c.nextMaintenanceDate.slice(0, 10) <= today);
    }
    case 'warranty_due':
      return clients.filter((c) =>
        opportunities.some((o) => o.clientId === c.id && o.category === 'warranty' && isVisibleOpportunity(o))
      );
    case 'active':
      return clients;
    case 'all':
    default:
      return clients;
  }
}

/** Filtro local en memoria -- ver searchClients() arriba para la versión que consulta el servidor. */
export function searchClientsLocal(clients: Client[], query: string): Client[] {
  if (!query.trim()) return clients;
  const q = query.toLowerCase();
  return clients.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
      c.address.toLowerCase().includes(q)
  );
}

// ============================================================
// ⚠️ TODAVÍA SOBRE localDb -- dependen de equipment/jobs, no migradas
// en este bloque.
// ============================================================

export function getClientEquipment(clientId: string, companyId: string): Equipment[] {
  return db
    .getAllForCompany<Equipment>(TABLES.equipment, companyId)
    .filter((e) => e.clientId === clientId);
}
