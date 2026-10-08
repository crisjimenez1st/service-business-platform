import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import { mapAgendaError } from './errors/agendaError';
import type { PublicReceipt } from '../types';

/** Token del recibo de un pago (se crea la primera vez). Solo owner/office; un pago anulado no admite recibo. */
export async function preparePaymentReceipt(paymentId: string): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.rpc('prepare_payment_receipt', { p_payment_id: paymentId });
    if (error) return fail(mapAgendaError(error));
    return ok(data);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

/** Enlace público del recibo que se envía al paciente. */
export function buildReceiptLink(token: string): string {
  return `${window.location.origin}/r/${token}`;
}

/** Página pública (sin sesión): null si el enlace no existe. */
export async function getPublicReceipt(token: string): Promise<ServiceResult<PublicReceipt | null>> {
  try {
    const { data, error } = await supabase.rpc('get_public_receipt', { p_token: token });
    if (error) return fail(mapSupabaseError(error));
    const row = data[0];
    if (!row) return ok(null);
    return ok({
      companyName: row.company_name,
      companyLogoUrl: row.company_logo_url ?? undefined,
      companyPhone: row.company_phone ?? undefined,
      clientFirstName: row.client_first_name,
      serviceName: row.service_name,
      amount: row.amount ?? undefined,
      currency: row.currency === 'USD' ? 'USD' : 'NIO',
      method: row.method,
      paidAt: row.paid_at,
      timezone: row.timezone,
      jobTotal: row.job_total ?? undefined,
      balance: row.balance ?? undefined,
      receiptCode: row.receipt_code,
      voided: row.voided,
    });
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
