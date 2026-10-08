import type { WaitlistEntry } from '../types';
import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import { mapAgendaError } from './errors/agendaError';

/**
 * Lista de espera. La lectura es directa (RLS owner/office); toda
 * escritura pasa por las RPCs add_to_waitlist / resolve_waitlist_entry
 * (validan que el cliente sea de la empresa y evitan duplicados).
 */

export async function getWaitlist(companyId: string): Promise<ServiceResult<WaitlistEntry[]>> {
  try {
    const { data, error } = await supabase
      .from('waitlist_entries')
      .select('id, client_id, note, service, created_at')
      .eq('company_id', companyId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    if (error) return fail(mapSupabaseError(error));
    return ok(
      data.map((r) => ({
        id: r.id,
        clientId: r.client_id,
        note: r.note ?? '',
        service: r.service ?? '',
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function addToWaitlist(
  companyId: string,
  input: { clientId: string; note?: string; service?: string }
): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('add_to_waitlist', {
      p_company_id: companyId,
      p_client_id: input.clientId,
      p_note: input.note ?? null,
      p_service: input.service ?? null,
    });
    if (error) return fail(mapAgendaError(error));
    return ok(null);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

export async function resolveWaitlistEntry(entryId: string, status: 'booked' | 'removed'): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('resolve_waitlist_entry', { p_entry_id: entryId, p_status: status });
    if (error) return fail(mapAgendaError(error));
    return ok(null);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}
