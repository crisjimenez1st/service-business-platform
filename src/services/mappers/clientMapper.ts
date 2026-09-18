import type { Client } from '../../types';
import type { Database } from '../../types/database.types';

type ClientRow = Database['public']['Tables']['clients']['Row'];

/**
 * Traduce una fila cruda de Supabase (snake_case, columnas SQL) al
 * tipo de dominio Client (camelCase) que ya usa toda la UI. Único
 * lugar que conoce ambas formas -- ni componentes ni el resto de
 * clientService tocan ClientRow directamente.
 *
 * Nota importante: varios campos de Client (mapsUrl, totalBilled,
 * totalPaid, pendingBalance, lastServiceDate, nextMaintenanceDate) NO
 * existen en la tabla clients de Supabase -- son datos derivados que
 * en el modelo real vendrían de jobs/payments/equipment, tablas que
 * todavía no se migran en este bloque. Se dejan undefined (son
 * opcionales en el tipo Client) en vez de inventar un valor o mezclar
 * con datos de localStorage -- la UI que los muestra
 * (ClientProfilePage, resumen financiero) mostrará "—" hasta que esas
 * entidades se migren y este mapper se actualice para poblarlos.
 */
export function clientRowToDomain(row: ClientRow): Client {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp ?? '',
    email: row.email ?? undefined,
    address: row.address ?? '',
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    mapsUrl: undefined,
    totalBilled: undefined,
    totalPaid: undefined,
    pendingBalance: undefined,
    lastServiceDate: undefined,
    nextMaintenanceDate: undefined,
  };
}

export interface ClientDomainInput {
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  notes?: string;
}

/** Traduce datos de formulario (camelCase, sin id/companyId/timestamps) a un Insert de Supabase. */
export function clientDomainToInsertRow(
  companyId: string,
  input: ClientDomainInput
): Database['public']['Tables']['clients']['Insert'] {
  return {
    company_id: companyId,
    name: input.name,
    phone: input.phone,
    whatsapp: input.whatsapp ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
  };
}

/** Traduce un parche parcial (camelCase) a un Update de Supabase -- solo incluye lo que vino definido. */
export function clientDomainToUpdateRow(
  patch: Partial<ClientDomainInput>
): Database['public']['Tables']['clients']['Update'] {
  const update: Database['public']['Tables']['clients']['Update'] = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.whatsapp !== undefined) update.whatsapp = patch.whatsapp;
  if (patch.email !== undefined) update.email = patch.email;
  if (patch.address !== undefined) update.address = patch.address;
  if (patch.notes !== undefined) update.notes = patch.notes;
  return update;
}
