import type {
  Payment,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
  Receivable,
  ReceivablesSummary,
  UnpricedJob,
  JobStatus,
  CurrencyCode,
} from '../../types';
import type { Database } from '../../types/database.types';

type Fns = Database['public']['Functions'];
type PaymentRow = Fns['get_job_payments']['Returns'][number];
type ReceivableRow = Fns['get_company_receivables']['Returns'][number];
type SummaryRow = Fns['get_receivables_summary']['Returns'][number];
type UnpricedRow = Fns['get_unpriced_jobs']['Returns'][number];

/**
 * Los campos numeric de Postgres pueden llegar como número o como
 * string según el driver/columna; se normalizan siempre a number aquí,
 * una sola vez, para que ningún componente tenga que sospechar de ello.
 */
function num(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

export function paymentRowToDomain(row: PaymentRow): Payment {
  return {
    id: row.id,
    amount: num(row.amount),
    paymentType: row.payment_type as PaymentType,
    method: row.method as PaymentMethod,
    paidAt: row.paid_at,
    reference: row.reference ?? undefined,
    note: row.note ?? undefined,
    recordedBy: row.recorded_by ?? undefined,
    voidedAt: row.voided_at ?? undefined,
    voidedBy: row.voided_by ?? undefined,
    voidReason: row.void_reason ?? undefined,
    createdAt: row.created_at,
  };
}

export function receivableRowToDomain(row: ReceivableRow): Receivable {
  return {
    jobId: row.job_id,
    clientId: row.client_id,
    clientName: row.client_name,
    serviceType: row.service_type,
    status: row.status as JobStatus,
    total: num(row.total),
    paidAmount: num(row.paid_amount),
    balance: num(row.balance),
    currency: row.currency as CurrencyCode,
    dueDate: row.due_date ?? undefined,
    paymentStatus: row.payment_status as PaymentStatus,
    isOverdue: row.is_overdue,
    requiresReview: row.requires_review,
  };
}

export function receivablesSummaryRowToDomain(row: SummaryRow): ReceivablesSummary {
  return {
    currency: row.currency as CurrencyCode,
    outstanding: num(row.outstanding),
    overdueAmount: num(row.overdue_amount),
    overdueCount: num(row.overdue_count),
    openCount: num(row.open_count),
  };
}

export function unpricedJobRowToDomain(row: UnpricedRow): UnpricedJob {
  return {
    jobId: row.job_id,
    clientId: row.client_id,
    clientName: row.client_name,
    serviceType: row.service_type,
    updatedAt: row.updated_at,
  };
}
