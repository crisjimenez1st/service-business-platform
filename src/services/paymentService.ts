import type { Job, Payment, Receivable, ReceivablesSummary, UnpricedJob, RecordPaymentInput } from '../types';
import { supabase } from '../lib/supabase';
import { jobRowToDomain } from './mappers/jobMapper';
import {
  paymentRowToDomain,
  receivableRowToDomain,
  receivablesSummaryRowToDomain,
  unpricedJobRowToDomain,
} from './mappers/paymentMapper';
import { mapSupabaseError, ok, fail, type ServiceError, type ServiceResult } from './errors/serviceError';

/**
 * paymentService: cobros y cuentas por cobrar (Bloque 6) para
 * owner/office. Toda ESCRITURA pasa por las RPCs transaccionales de la
 * migración 012 (record_payment, void_payment, set_job_financial_terms)
 * -- nunca un INSERT/UPDATE/DELETE directo sobre payments o jobs; el
 * servidor es la única autoridad sobre sobrepagos, totales y saldos.
 * Las lecturas también son RPCs (012/013) porque agregan y filtran por
 * rol en el servidor.
 *
 * record_payment, void_payment y set_job_financial_terms devuelven la
 * fila de jobs ya actualizada (con paid_amount recalculado); el
 * historial de pagos se recarga aparte con getJobPayments.
 */

/**
 * Las RPCs de cobros lanzan `raise exception` con mensajes en español
 * pensados para personas (código P0001). Se traducen a mensajes fijos y
 * seguros -- nunca se muestra el texto crudo del servidor, porque
 * algunos incluyen ids internos o nombres de funciones.
 */
const BUSINESS_ERRORS: { match: string; message: string }[] = [
  { match: 'excede el saldo pendiente', message: 'El pago es mayor al saldo pendiente de este trabajo.' },
  { match: 'no tiene un total válido', message: 'Este trabajo todavía no tiene un total. Define el total primero.' },
  { match: 'monto del pago debe ser mayor a cero', message: 'El monto del pago debe ser mayor a cero.' },
  { match: 'El total debe ser un monto mayor a cero', message: 'El total debe ser mayor a cero.' },
  { match: 'no puede ser menor al monto ya pagado', message: 'El total no puede ser menor a lo que ya se ha cobrado.' },
  { match: 'No se pueden modificar los términos financieros', message: 'No se pueden cambiar las condiciones de un trabajo completado o cancelado.' },
  { match: 'ya fue anulado', message: 'Este pago ya fue anulado.' },
  { match: 'motivo de anulación es obligatorio', message: 'Escribe el motivo de la anulación.' },
  { match: 'No autorizado', message: 'No tienes permiso para realizar esta acción.' },
  { match: 'No autenticado', message: 'Tu sesión expiró. Vuelve a iniciar sesión.' },
];

function mapPaymentError(err: unknown): ServiceError {
  if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
    const { code, message } = err as { code: string; message: string };
    if (code === 'P0001') {
      const known = BUSINESS_ERRORS.find((e) => message.includes(e.match));
      if (known) return { kind: 'unknown', message: known.message, cause: err };
    }
  }
  return mapSupabaseError(err);
}

export async function getJobPayments(jobId: string): Promise<ServiceResult<Payment[]>> {
  try {
    const { data, error } = await supabase.rpc('get_job_payments', { p_job_id: jobId });
    if (error) return fail(mapPaymentError(error));
    return ok(data.map(paymentRowToDomain));
  } catch (err) {
    return fail(mapPaymentError(err));
  }
}

/** Registra un pago sobre un Job y devuelve el Job con paid_amount recalculado. */
export async function recordPayment(input: RecordPaymentInput): Promise<ServiceResult<Job>> {
  try {
    const { data, error } = await supabase.rpc('record_payment', {
      p_job_id: input.jobId,
      p_amount: input.amount,
      p_payment_type: input.paymentType,
      p_method: input.method,
      p_paid_at: input.paidAt,
      p_reference: input.reference ?? null,
      p_note: input.note ?? null,
    });
    if (error) return fail(mapPaymentError(error));
    return ok(jobRowToDomain(data));
  } catch (err) {
    return fail(mapPaymentError(err));
  }
}

/** Anula un pago (motivo obligatorio) y devuelve el Job con paid_amount recalculado. El pago nunca se borra. */
export async function voidPayment(paymentId: string, reason: string): Promise<ServiceResult<Job>> {
  try {
    const { data, error } = await supabase.rpc('void_payment', {
      p_payment_id: paymentId,
      p_void_reason: reason,
    });
    if (error) return fail(mapPaymentError(error));
    return ok(jobRowToDomain(data));
  } catch (err) {
    return fail(mapPaymentError(err));
  }
}

/**
 * Define o corrige el total y el vencimiento de un Job (no completado
 * ni cancelado). `dueDate` es una fecha calendario YYYY-MM-DD o null
 * para quitar el vencimiento.
 */
export async function setJobFinancialTerms(
  jobId: string,
  total: number,
  dueDate: string | null
): Promise<ServiceResult<Job>> {
  try {
    const { data, error } = await supabase.rpc('set_job_financial_terms', {
      p_job_id: jobId,
      p_total: total,
      p_due_date: dueDate,
    });
    if (error) return fail(mapPaymentError(error));
    return ok(jobRowToDomain(data));
  } catch (err) {
    return fail(mapPaymentError(err));
  }
}

export async function getCompanyReceivables(companyId: string): Promise<ServiceResult<Receivable[]>> {
  try {
    const { data, error } = await supabase.rpc('get_company_receivables', { p_company_id: companyId });
    if (error) return fail(mapPaymentError(error));
    return ok(data.map(receivableRowToDomain));
  } catch (err) {
    return fail(mapPaymentError(err));
  }
}

export async function getReceivablesSummary(companyId: string): Promise<ServiceResult<ReceivablesSummary[]>> {
  try {
    const { data, error } = await supabase.rpc('get_receivables_summary', { p_company_id: companyId });
    if (error) return fail(mapPaymentError(error));
    return ok(data.map(receivablesSummaryRowToDomain));
  } catch (err) {
    return fail(mapPaymentError(err));
  }
}

export async function getUnpricedJobs(companyId: string): Promise<ServiceResult<UnpricedJob[]>> {
  try {
    const { data, error } = await supabase.rpc('get_unpriced_jobs', { p_company_id: companyId });
    if (error) return fail(mapPaymentError(error));
    return ok(data.map(unpricedJobRowToDomain));
  } catch (err) {
    return fail(mapPaymentError(err));
  }
}
