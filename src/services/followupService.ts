import type { FollowupDue } from '../types/followup';
import { supabase } from '../lib/supabase';
import { createOpportunity } from './opportunityService';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

/**
 * followupService: avisos de seguimiento ("volver en 2 meses"). Un
 * seguimiento es una Opportunity con type='recall' (migración 014).
 * La lectura es la RPC get_followups_due, que ya filtra por la fecha de
 * HOY de la empresa, consentimiento y rol (owner/office).
 *
 * Posponer y descartar reutilizan opportunityService. "Agendó" marca
 * 'converted' SOLO para recall -- nunca para el resto de oportunidades,
 * cuyo 'converted' significa "se creó una cotización".
 */

export async function getFollowupsDue(companyId: string): Promise<ServiceResult<FollowupDue[]>> {
  try {
    const { data, error } = await supabase.rpc('get_followups_due', { p_company_id: companyId });
    if (error) return fail(mapSupabaseError(error));
    return ok(
      data.map((r) => ({
        opportunityId: r.opportunity_id,
        clientId: r.client_id,
        clientName: r.client_name,
        clientPhone: r.client_phone,
        clientWhatsapp: r.client_whatsapp ?? undefined,
        title: r.title,
        reason: r.reason ?? '',
        status: r.status as FollowupDue['status'],
        dueDate: r.due_date,
        daysOverdue: r.days_overdue,
        lastContactedAt: r.last_contacted_at ?? undefined,
        lastVisitAt: r.last_visit_at ?? undefined,
      }))
    );
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function markFollowupBooked(companyId: string, opportunityId: string): Promise<ServiceResult<null>> {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ status: 'converted' })
      .eq('id', opportunityId)
      .eq('company_id', companyId)
      .eq('type', 'recall')
      .select('id')
      .maybeSingle();
    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos ese seguimiento.' });
    return ok(null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Crea un seguimiento para un cliente existente (ej. al terminar una cita). dueDate es YYYY-MM-DD. */
export async function createFollowup(
  companyId: string,
  input: { clientId: string; dueDate: string; reason?: string }
): Promise<ServiceResult<null>> {
  const result = await createOpportunity(companyId, {
    clientId: input.clientId,
    category: 'recall',
    title: 'Seguimiento',
    reason: input.reason,
    estimatedValue: 0,
    dueDate: input.dueDate,
  });
  return result.error ? fail(result.error) : ok(null);
}
