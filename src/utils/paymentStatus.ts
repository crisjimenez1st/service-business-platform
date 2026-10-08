import type { Job, PaymentMethod, PaymentStatus, PaymentType } from '../types';
import type { BadgeTone } from './jobStatus';
import { getTodayKeyInTimezone } from './timezone';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Sin pago',
  partial: 'Pago parcial',
  paid: 'Pagado',
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, BadgeTone> = {
  unpaid: 'warning',
  partial: 'info',
  paid: 'success',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  other: 'Otro',
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  deposit: 'Anticipo',
  partial: 'Abono',
  final: 'Pago final',
  other: 'Otro',
};

export interface JobFinancials {
  hasTotal: boolean;
  total: number;
  paidAmount: number;
  /** 0 en Jobs cancelados: lo cobrado se revisa aparte, no es deuda. */
  balance: number;
  paymentStatus: PaymentStatus;
  isOverdue: boolean;
  /** Job cancelado con dinero cobrado todavía activo. */
  requiresReview: boolean;
}

/**
 * Estado financiero de un Job, derivado de total/paidAmount/dueDate --
 * mismas reglas que get_company_receivables (migración 013), pero
 * "hoy" se toma en la timezone de la empresa y no en la del servidor.
 * Nunca se guarda: el estado operativo (status) y el financiero son
 * independientes.
 */
export function getJobFinancials(job: Job, timezone: string): JobFinancials {
  const total = job.total ?? 0;
  const paidAmount = job.paidAmount ?? 0;
  const hasTotal = job.total !== undefined && total > 0;
  const cancelled = job.status === 'cancelled';

  const paymentStatus: PaymentStatus =
    hasTotal && paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  const isOverdue =
    hasTotal &&
    !cancelled &&
    job.dueDate !== undefined &&
    job.dueDate < getTodayKeyInTimezone(timezone) &&
    paidAmount < total;

  return {
    hasTotal,
    total,
    paidAmount,
    balance: cancelled || !hasTotal ? 0 : Math.max(total - paidAmount, 0),
    paymentStatus,
    isOverdue,
    requiresReview: cancelled && paidAmount > 0,
  };
}
