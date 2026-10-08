import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import type { AppointmentRequest, AppointmentRequestStatus, PublicBooking } from '../types';
import type { Database } from '../types/database.types';

type RequestRow = Database['public']['Tables']['appointment_requests']['Row'];

function toDomain(r: RequestRow): AppointmentRequest {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    phoneKey: r.phone_key,
    service: r.service,
    preferred: r.preferred ?? undefined,
    note: r.note ?? undefined,
    status: r.status as AppointmentRequestStatus,
    createdAt: r.created_at,
  };
}

/** Enlace que el consultorio comparte con sus pacientes. */
export function buildBookingLink(token: string): string {
  return `${window.location.origin}/cita/${token}`;
}

// ---------- Página pública (sin sesión) ----------

export async function getPublicBooking(token: string): Promise<ServiceResult<PublicBooking | null>> {
  try {
    const { data, error } = await supabase.rpc('get_public_booking', { p_token: token });
    if (error) return fail(mapSupabaseError(error));
    const row = data[0];
    if (!row) return ok(null);
    return ok({
      companyName: row.company_name,
      companyLogoUrl: row.company_logo_url ?? undefined,
      companyPhone: row.company_phone ?? undefined,
      services: row.services ?? [],
    });
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export type SubmitRequestResult = 'ok' | 'invalid' | 'too_many' | 'not_found';

export async function submitAppointmentRequest(input: {
  token: string;
  name: string;
  phone: string;
  service: string;
  preferred?: string;
  note?: string;
}): Promise<ServiceResult<SubmitRequestResult>> {
  try {
    const { data, error } = await supabase.rpc('submit_appointment_request', {
      p_token: input.token,
      p_name: input.name,
      p_phone: input.phone,
      p_service: input.service,
      p_preferred: input.preferred || null,
      p_note: input.note || null,
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(data as SubmitRequestResult);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ---------- Equipo (dueño y recepción) ----------

export async function getAppointmentRequests(companyId: string): Promise<ServiceResult<AppointmentRequest[]>> {
  try {
    const { data, error } = await supabase
      .from('appointment_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(toDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function countPendingRequests(companyId: string): Promise<ServiceResult<number>> {
  try {
    const { count, error } = await supabase
      .from('appointment_requests')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pending');
    if (error) return fail(mapSupabaseError(error));
    return ok(count ?? 0);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function resolveAppointmentRequest(
  id: string,
  status: Exclude<AppointmentRequestStatus, 'pending'>,
): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('resolve_appointment_request', { p_id: id, p_status: status });
    if (error) return fail(mapSupabaseError(error));
    return ok(null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Activa o apaga el enlace. Solo el dueño puede (política de companies). */
export async function setBookingEnabled(companyId: string, enabled: boolean): Promise<ServiceResult<null>> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .update({ booking_enabled: enabled })
      .eq('id', companyId)
      .select('id')
      .maybeSingle();
    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'forbidden', message: 'Solo el dueño puede cambiar esto.' });
    return ok(null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
