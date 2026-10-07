import type { AppointmentResponse, AppointmentResponseValue, PublicAppointment } from '../types';
import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import { mapAgendaError } from './errors/agendaError';

/**
 * Recordatorio de cita con confirmación OPCIONAL del paciente
 * (migración 016). Es un recordatorio: que el paciente no responda no es
 * un problema; si abre su enlace puede confirmar o avisar que no podrá, y
 * la clínica también puede marcarlo a mano. Toda escritura pasa por RPCs.
 */

export async function getAppointmentResponses(
  companyId: string,
  jobIds: string[]
): Promise<ServiceResult<AppointmentResponse[]>> {
  if (jobIds.length === 0) return ok([]);
  try {
    const { data, error } = await supabase
      .from('appointment_responses')
      .select('job_id, response, response_source, reminded_at')
      .eq('company_id', companyId)
      .in('job_id', jobIds);
    if (error) return fail(mapSupabaseError(error));
    return ok(
      data.map((r) => ({
        jobId: r.job_id,
        response: (r.response as AppointmentResponseValue | null) ?? undefined,
        responseSource: (r.response_source as 'patient' | 'staff' | null) ?? undefined,
        remindedAt: r.reminded_at ?? undefined,
      }))
    );
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Token del enlace de la cita (se crea la primera vez). */
export async function prepareAppointmentLink(jobId: string): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.rpc('prepare_appointment_link', { p_job_id: jobId });
    if (error) return fail(mapAgendaError(error));
    return ok(data);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

export async function markAppointmentReminded(jobId: string): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('mark_appointment_reminded', { p_job_id: jobId });
    if (error) return fail(mapAgendaError(error));
    return ok(null);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

/** Marca a mano la respuesta (null = borrarla, por si se marcó por error). */
export async function setAppointmentResponse(
  jobId: string,
  response: AppointmentResponseValue | null
): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('set_appointment_response', { p_job_id: jobId, p_response: response });
    if (error) return fail(mapAgendaError(error));
    return ok(null);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

/** Enlace público que se envía al paciente. */
export function buildAppointmentLink(token: string): string {
  return `${window.location.origin}/c/${token}`;
}

// ---------- Página pública (sin sesión) ----------

export async function getPublicAppointment(token: string): Promise<ServiceResult<PublicAppointment | null>> {
  try {
    const { data, error } = await supabase.rpc('get_public_appointment', { p_token: token });
    if (error) return fail(mapSupabaseError(error));
    const row = data[0];
    if (!row) return ok(null);
    return ok({
      companyName: row.company_name,
      companyLogoUrl: row.company_logo_url ?? undefined,
      companyPhone: row.company_phone ?? undefined,
      clientFirstName: row.client_first_name,
      scheduledStartAt: row.scheduled_start_at,
      timezone: row.timezone,
      response: (row.response as AppointmentResponseValue | null) ?? undefined,
      canRespond: row.can_respond,
    });
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export type PublicResponseResult = 'ok' | 'not_available' | 'not_found';

export async function respondPublicAppointment(
  token: string,
  response: AppointmentResponseValue
): Promise<ServiceResult<PublicResponseResult>> {
  try {
    const { data, error } = await supabase.rpc('respond_public_appointment', { p_token: token, p_response: response });
    if (error) return fail(mapSupabaseError(error));
    return ok(data === 'ok' ? 'ok' : data === 'not_available' ? 'not_available' : 'not_found');
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
