import type { Quote, QuoteItem, QuoteStatus, RejectionReason, JobDraft, PublicQuoteView } from '../../types';
import type { Database } from '../../types/database.types';

type QuoteRow = Database['public']['Tables']['quotes']['Row'];
type QuoteItemRow = Database['public']['Tables']['quote_items']['Row'];
type JobDraftRow = Database['public']['Tables']['job_drafts']['Row'];

/**
 * Traduce una fila de quote_items (snake_case) al tipo de dominio
 * QuoteItem (camelCase). Sin diferencias de esquema -- mapeo directo.
 */
export function quoteItemRowToDomain(row: QuoteItemRow): QuoteItem {
  return {
    id: row.id,
    quoteId: row.quote_id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    discount: row.discount,
    subtotal: row.subtotal,
  };
}

/**
 * Traduce una fila de quotes + sus items ya cargados al tipo de
 * dominio Quote. Requiere los items por separado (join explícito, no
 * embebido) -- mismo criterio que CompanyContext (Fase 2.5, bloque
 * Auth): evitar depender de la inferencia de joins embebidos de
 * supabase-js con un tipo Database escrito a mano.
 */
export function quoteRowToDomain(row: QuoteRow, items: QuoteItemRow[]): Quote {
  return {
    id: row.id,
    companyId: row.company_id,
    clientId: row.client_id,
    opportunityId: row.opportunity_id ?? undefined,
    quoteNumber: row.quote_number,
    status: row.status as QuoteStatus,
    issueDate: row.issue_date,
    expirationDate: row.expiration_date,
    notes: row.notes ?? undefined,
    items: items.map(quoteItemRowToDomain),
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    total: row.total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at ?? undefined,
    viewedAt: row.viewed_at ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    rejectionReason: (row.rejection_reason as RejectionReason | null) ?? undefined,
    publicToken: row.public_token,
  };
}

/** Ítem tal como se envía a las RPC (create_quote, create_quote_from_opportunity, update_quote_draft) -- shape jsonb, no una tabla. */
export interface QuoteItemRpcInput {
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export function quoteItemDomainToRpcInput(item: {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}): QuoteItemRpcInput {
  return {
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    discount: item.discount,
  };
}

/**
 * Traduce una fila de job_drafts al tipo de dominio JobDraft. Mapeo
 * directo 1:1 (title/description/estimated_total -> title/description/
 * estimatedTotal) -- el tipo de dominio se alineó con el esquema real,
 * ya no hay traducción de nombres legacy que documentar aquí.
 */
export function jobDraftRowToDomain(row: JobDraftRow): JobDraft {
  return {
    id: row.id,
    companyId: row.company_id,
    clientId: row.client_id,
    quoteId: row.quote_id,
    title: row.title,
    description: row.description ?? undefined,
    estimatedTotal: row.estimated_total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// Mapper PÚBLICO -- separado a propósito del mapper administrativo de
// arriba. Traduce el resultado crudo de la RPC get_public_quote_by_token
// (una fila de su Returns, ver database.types.ts) al tipo de dominio
// PublicQuoteView. Nunca debe tocar ni conocer QuoteRow/quoteRowToDomain
// -- son dos mundos de datos distintos (uno con sesión y todas las
// columnas, otro sin sesión y solo lo estrictamente necesario) y
// mezclarlos en un solo mapper facilitaría que algún día alguien filtre
// un campo privado a la vista pública por accidente.
// ============================================================

type PublicQuoteRpcRow =
  Database['public']['Functions']['get_public_quote_by_token']['Returns'][number];

/**
 * `status` que llega de la RPC ya es el status BASE persistido (no el
 * efectivo) -- la RPC no recalcula expired, así que este mapper aplica
 * la misma regla de vencimiento que quoteService.getEffectiveStatus
 * (sent/viewed + expiration_date < hoy => expired) para que la UI
 * pública reciba directamente el estado que debe mostrar.
 */
export function publicQuoteRowToView(row: PublicQuoteRpcRow): PublicQuoteView {
  const baseStatus = row.status as QuoteStatus;
  const isPastExpiration = new Date(row.expiration_date) < new Date();
  const effectiveStatus: QuoteStatus =
    isPastExpiration && (baseStatus === 'sent' || baseStatus === 'viewed') ? 'expired' : baseStatus;

  return {
    quoteNumber: row.quote_number,
    effectiveStatus,
    issueDate: row.issue_date,
    expirationDate: row.expiration_date,
    notes: row.notes ?? undefined,
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    total: row.total,
    currency: row.currency,
    clientName: row.client_name,
    companyName: row.company_name,
    companyLogoUrl: row.company_logo_url ?? undefined,
    companyPhone: row.company_phone ?? undefined,
    items: row.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discount: item.discount,
      subtotal: item.subtotal,
    })),
  };
}
