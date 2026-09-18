import type { UUID } from './core';

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

// ⚠️ QuoteDraft (Fase 1/2, borrador intermedio en localDb para el flujo
// Oportunidad -> Cotización) se ELIMINÓ tras la migración de Quotes a
// Supabase. Ya no existe ningún estado intermedio: "Crear cotización"
// desde una Oportunidad ejecuta directamente
// quoteService.createQuoteFromOpportunity, que llama a la RPC
// transaccional create_quote_from_opportunity y crea una Quote real
// (status draft) + sus QuoteItems + marca la Opportunity como
// converted, todo en una sola operación atómica de servidor. No
// reintroducir un tipo de "borrador antes del borrador" -- si algo
// necesita datos previos a que exista una Quote, esa necesidad debe
// resolverse con parámetros de función, no con una tabla intermedia.

export interface QuoteItem {
  id: UUID;
  quoteId: UUID;
  description: string;
  quantity: number;
  unitPrice: number;
  /** monto, no porcentaje */
  discount?: number;
  subtotal: number;
}

export type RejectionReason =
  | 'price'
  | 'chose_another_provider'
  | 'not_needed_now'
  | 'wants_changes'
  | 'other';

export interface Quote {
  id: UUID;
  companyId: UUID;
  clientId: UUID;
  /** Presente cuando la cotización vino de "Crear cotización" en una Oportunidad. */
  opportunityId?: UUID;
  /** Número profesional visible, ej. "COT-0001". Único por companyId. */
  quoteNumber: string;
  status: QuoteStatus;
  issueDate: string;
  expirationDate: string;
  notes?: string;
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: RejectionReason;
  /**
   * Token de acceso a la página pública `/q/:publicToken`. No debe ser
   * adivinable — generado con crypto.randomUUID(). Es el ÚNICO mecanismo
   * de acceso público; companyId nunca se expone en la ruta pública.
   */
  publicToken: string;
}

/**
 * Vista pública de una cotización, expuesta vía la RPC
 * get_public_quote_by_token (supabase/migrations/005). Deliberadamente
 * NO es un alias ni un subset tipado de Quote: es un tipo separado
 * porque su contrato es "lo que un visitante anónimo puede ver", y
 * mezclarlo con Quote (aunque fuera con campos opcionales) arriesgaría
 * que algún día alguien intente acceder a `.id`/`.companyId`/`.clientId`
 * sobre un objeto que nunca los tuvo. Nunca debe ampliarse con id,
 * companyId, clientId, ids internos de QuoteItem, ni ningún otro campo
 * que la RPC no exponga explícitamente.
 */
export interface PublicQuoteView {
  quoteNumber: string;
  /** Ya resuelto (sent/viewed/expired/etc.) -- ver quoteService.getEffectiveStatus, misma regla aplicada del lado de la RPC. */
  effectiveStatus: QuoteStatus;
  issueDate: string;
  expirationDate: string;
  notes?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  clientName: string;
  companyName: string;
  companyLogoUrl?: string;
  companyPhone?: string;
  items: PublicQuoteItemView[];
}

export interface PublicQuoteItemView {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

/**
 * Objeto preliminar creado al pulsar "Crear orden de trabajo" desde una
 * cotización aceptada. El módulo completo de Órdenes de Trabajo (Fase 3)
 * lo recupera y construye el Job real.
 *
 * Campos alineados 1:1 con la tabla real `job_drafts` de Supabase
 * (title/description/estimatedTotal), no con nombres heredados del
 * mock de Fase 1/2 -- ya no hay razón para mantener nombres legacy
 * ("serviceDescription") una vez que el backend real define el modelo.
 * Sin campo `consumed`: la idempotencia de JobDraft la garantiza la
 * constraint unique(quote_id) + create_job_draft en SQL (ver migración
 * 006) -- un JobDraft simplemente existe o no existe para una Quote
 * dada, no hay un estado intermedio de "consumido" que rastrear.
 */
export interface JobDraft {
  id: UUID;
  companyId: UUID;
  clientId: UUID;
  quoteId: UUID;
  title: string;
  description?: string;
  estimatedTotal: number;
  createdAt: string;
  updatedAt: string;
}

/** Fila devuelta por get_company_technicians() -- solo lo necesario para un selector de asignación, nunca expone auth.users directamente. */
export interface CompanyTechnician {
  userId: UUID;
  displayName: string;
  email: string;
}

/**
 * ⚠️ LEGACY/MOCK -- shape original de Fase 1, usado únicamente por
 * datos demo en localDb (seedJobs.ts) y las pantallas que todavía no
 * se migraron a Supabase (TodayJobCard, JobHistoryCard, dashboardService
 * "Trabajos de hoy", ClientProfilePage). Deliberadamente separado del
 * Job real (arriba) -- mezclarlos forzaría a este código mock a fingir
 * columnas que no tiene (scheduledStartAt/scheduledEndAt reales), o al
 * revés, contaminaría el modelo real con technicianId/scheduledDate/
 * scheduledTime que ya no existen en la tabla jobs. Se retira cuando
 * Jobs se migre por completo (Dashboard, ClientProfile) en un bloque
 * futuro -- ningún código nuevo debe usar este tipo.
 */
export interface MockJob {
  id: UUID;
  companyId: UUID;
  clientId: UUID;
  quoteId?: UUID;
  technicianId?: UUID;
  serviceType: string;
  status: JobStatus;
  scheduledDate: string; // ISO date
  scheduledTime: string; // "10:00"
  address: string;
  mapsUrl?: string;
  notes?: string;
  checklist?: { id: UUID; label: string; done: boolean }[];
  photos?: JobPhoto[];
  materials?: JobMaterial[];
  total?: number;
  paidAmount?: number;
  createdAt: string;
}

export type JobStatus =
  | 'new'
  | 'scheduled'
  | 'en_route'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface JobPhoto {
  id: UUID;
  jobId: UUID;
  stage: 'before' | 'during' | 'after';
  url: string;
  takenAt: string;
}

export interface JobMaterial {
  id: UUID;
  jobId: UUID;
  name: string;
  quantity: number;
  unit: string;
}

/**
 * Modelo real de Job, alineado 1:1 con la tabla jobs de Supabase (Fase
 * 3, Bloque 1: 007_jobs_schema.sql). Reemplaza el Job mock de Fase 1
 * (que usaba scheduledDate/scheduledTime string separados sobre
 * localDb) -- ese modelo quedó obsoleto en cuanto el esquema real usa
 * scheduled_start_at/scheduled_end_at como timestamptz.
 */
export interface Job {
  id: UUID;
  companyId: UUID;
  clientId: UUID;
  quoteId?: UUID;
  jobDraftId?: UUID;
  assignedTechnicianId?: UUID;
  serviceType: string;
  /** Contexto/instrucciones originales del trabajo (copiado del JobDraft al crearse, o provisto al crear manualmente). Nunca se sobrescribe automáticamente -- distinto de notes. */
  description?: string;
  /** Notas operativas mutables, añadidas después por el técnico o por admin. */
  notes?: string;
  status: JobStatus;
  /** ISO timestamptz. Ausente si el Job todavía no está programado (status='new'). */
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  address?: string;
  mapsUrl?: string;
  total?: number;
  paidAmount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Vista limitada de un Job devuelta por get_my_assigned_jobs() -- NO
 * reutiliza Job a propósito, igual que PublicQuoteView no reutiliza
 * Quote: es un tipo separado porque su contrato es "lo que un técnico
 * puede ver de su propio trabajo", nunca debe ampliarse con
 * companyId, quoteId, jobDraftId, total, paidAmount, ni
 * assignedTechnicianId (ya se sabe que es el propio usuario).
 */
export interface MyAssignedJob {
  id: UUID;
  clientId: UUID;
  clientName: string;
  clientPhone: string;
  clientWhatsapp?: string;
  serviceType: string;
  description?: string;
  status: JobStatus;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  address?: string;
  mapsUrl?: string;
  notes?: string;
}

/** Fila devuelta por get_company_technicians() -- solo lo necesario para un selector de asignación, nunca expone auth.users directamente. */
export interface CompanyTechnician {
  userId: UUID;
  displayName: string;
  email: string;
}

