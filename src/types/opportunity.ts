import type { UUID } from './core';

/**
 * OPPORTUNITY es el corazón del producto.
 * Cada oportunidad representa dinero que la empresa perdería
 * si nadie le recuerda contactar al cliente.
 */
export type OpportunityCategory =
  | 'maintenance' // mantenimiento periódico (3/6/12 meses)
  | 'warranty' // garantía próxima a vencer
  | 'inactive_client' // cliente sin compras hace tiempo
  | 'equipment_replacement' // equipo próximo a fin de vida útil
  | 'expansion' // posible ampliación del sistema
  | 'upsell'; // UPS, HDD, limpieza, actualización, renovación de contrato

export type OpportunityStatus =
  | 'active'
  | 'contacted'
  | 'postponed'
  | 'converted' // se generó una cotización
  | 'discarded';

export interface Opportunity {
  id: UUID;
  companyId: UUID;
  clientId: UUID;
  category: OpportunityCategory;
  title: string; // ej. "Mantenimiento de 6 meses"
  reason: string; // ej. "Último servicio hace 6 meses"
  estimatedValue: number;
  status: OpportunityStatus;
  dueDate: string; // fecha sugerida de contacto/servicio
  relatedEquipmentId?: UUID;
  relatedJobId?: UUID;
  createdAt: string;
  postponedTo?: string;
  discardedAt?: string;
  discardedReason?: string;
  convertedQuoteId?: UUID;
}

export const OPPORTUNITY_CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  maintenance: 'Mantenimiento',
  warranty: 'Garantía',
  inactive_client: 'Cliente inactivo',
  equipment_replacement: 'Reemplazo de equipo',
  expansion: 'Ampliación',
  upsell: 'Venta adicional',
};
