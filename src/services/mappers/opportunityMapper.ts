import type { Opportunity, OpportunityCategory, OpportunityStatus } from '../../types';
import type { Database, OpportunityStatusDb } from '../../types/database.types';

type OpportunityRow = Database['public']['Tables']['opportunities']['Row'];

/**
 * Traduce una fila cruda de Supabase (snake_case) al tipo de dominio
 * Opportunity (camelCase) que ya usa toda la UI -- mismo patrón que
 * clientMapper.ts (Clients, primer bloque migrado).
 *
 * Diferencias de esquema documentadas (no se inventan valores):
 * - La tabla SQL `opportunities` usa `type` (texto libre) donde el
 *   dominio usa `category` (unión cerrada de 6 valores). Se hace un
 *   cast controlado -- `type` en SQL SIEMPRE se escribe desde
 *   `opportunityDomainToInsertRow`, que solo acepta OpportunityCategory,
 *   así que en la práctica el valor en base de datos ya está acotado a
 *   esos 6 valores; el cast documenta esa garantía sin necesitar un
 *   CHECK adicional en SQL para este campo derivado de UI.
 * - `description` (SQL) se mapea a `reason` (dominio).
 * - `status` de SQL admite 'postponed' como valor real (CHECK de la
 *   migración 001) -- esta migración SÍ lo usa como estado persistido
 *   al posponer (ver opportunityService.postponeOpportunity), a
 *   diferencia del comportamiento anterior sobre localDb que dejaba
 *   'active'. Cambio de comportamiento pedido explícitamente en esta
 *   fase.
 * - `postponedTo`, `discardedAt`, `discardedReason`, `convertedQuoteId`
 *   del dominio (Fase 1/2, derivados en memoria) no tienen columna
 *   propia en SQL -- se dejan undefined; `dueDate` ya refleja la fecha
 *   pospuesta directamente (no hace falta un campo separado
 *   `postponedTo`).
 */
export function opportunityRowToDomain(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    companyId: row.company_id,
    clientId: row.client_id,
    category: row.type as OpportunityCategory,
    title: row.title,
    reason: row.description ?? '',
    estimatedValue: row.estimated_value,
    status: row.status as OpportunityStatus,
    dueDate: row.due_date ?? '',
    relatedEquipmentId: row.source_equipment_id ?? undefined,
    createdAt: row.created_at,
  };
}

export interface OpportunityDomainInput {
  clientId: string;
  category: OpportunityCategory;
  title: string;
  reason?: string;
  estimatedValue: number;
  dueDate?: string;
  relatedEquipmentId?: string;
}

export function opportunityDomainToInsertRow(
  companyId: string,
  input: OpportunityDomainInput
): Database['public']['Tables']['opportunities']['Insert'] {
  return {
    company_id: companyId,
    client_id: input.clientId,
    type: input.category,
    title: input.title,
    description: input.reason ?? null,
    estimated_value: input.estimatedValue,
    due_date: input.dueDate ?? null,
    source_equipment_id: input.relatedEquipmentId ?? null,
  };
}

/** Identidad tipada -- el dominio y la DB comparten exactamente los mismos 5 valores de estado. */
export function opportunityStatusToDb(status: OpportunityStatus): OpportunityStatusDb {
  return status;
}
