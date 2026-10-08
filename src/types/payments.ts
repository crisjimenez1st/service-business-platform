import type { UUID, CurrencyCode } from './core';
import type { JobStatus } from './jobs';

/** Valores aceptados por el CHECK de payments.payment_type (migración 012). */
export type PaymentType = 'deposit' | 'partial' | 'final' | 'other';

/** Valores aceptados por el CHECK de payments.method (migración 012). */
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'check' | 'other';

/**
 * Estado financiero DERIVADO de total/paid_amount -- nunca se almacena,
 * y es independiente del estado operativo del Job (status). Ver
 * get_company_receivables (migración 013).
 */
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

/**
 * Un pago registrado sobre un Job. Los pagos nunca se editan ni se
 * borran: se anulan (voidedAt) con motivo obligatorio y se registra uno
 * nuevo si hay que corregir. Ver void_payment (migración 012).
 */
export interface Payment {
  id: UUID;
  amount: number;
  paymentType: PaymentType;
  method: PaymentMethod;
  paidAt: string;
  reference?: string;
  note?: string;
  recordedBy?: UUID;
  voidedAt?: string;
  voidedBy?: UUID;
  voidReason?: string;
  createdAt: string;
}

/** Una fila de cuentas por cobrar (get_company_receivables). */
export interface Receivable {
  jobId: UUID;
  clientId: UUID;
  clientName: string;
  serviceType: string;
  status: JobStatus;
  total: number;
  paidAmount: number;
  /** Saldo pendiente. 0 para Jobs cancelados -- su dinero cobrado se revisa aparte (requiresReview). */
  balance: number;
  currency: CurrencyCode;
  /** Fecha calendario (YYYY-MM-DD). Sin hora ni zona: es un día de vencimiento. */
  dueDate?: string;
  paymentStatus: PaymentStatus;
  isOverdue: boolean;
  /** Job cancelado con pagos activos: hay dinero cobrado que alguien debe revisar. */
  requiresReview: boolean;
}

/** Totales por cobrar de una moneda (get_receivables_summary). Una fila por moneda: nunca se suman monedas distintas. */
export interface ReceivablesSummary {
  currency: CurrencyCode;
  outstanding: number;
  overdueAmount: number;
  overdueCount: number;
  openCount: number;
}

/** Job completado sin total válido (get_unpriced_jobs): trabajo hecho que todavía no se puede cobrar. */
export interface UnpricedJob {
  jobId: UUID;
  clientId: UUID;
  clientName: string;
  serviceType: string;
  updatedAt: string;
}

export interface RecordPaymentInput {
  jobId: UUID;
  amount: number;
  paymentType: PaymentType;
  method: PaymentMethod;
  /** ISO timestamptz. */
  paidAt: string;
  reference?: string;
  note?: string;
}
