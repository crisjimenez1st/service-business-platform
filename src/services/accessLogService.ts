import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

export type AccessKind = 'view_clinical' | 'export' | 'delete';

export interface AccessLogEntry {
  at: string;
  kind: AccessKind;
  clientName: string;
  userEmail: string;
  userRole: string;
}

/** Anota un acceso a datos de un paciente. Nunca bloquea la acción del usuario. */
export async function logRecordAccess(companyId: string, clientId: string, kind: AccessKind): Promise<void> {
  try {
    await supabase.rpc('log_record_access', { p_company_id: companyId, p_client_id: clientId, p_kind: kind });
  } catch {
    // El registro es una ayuda de auditoría: si falla, no se interrumpe el trabajo.
  }
}

/** Últimos accesos de la clínica (solo dueño). */
export async function getAccessLog(companyId: string): Promise<ServiceResult<AccessLogEntry[]>> {
  try {
    const { data, error } = await supabase.rpc('get_access_log', { p_company_id: companyId, p_limit: 100 });
    if (error) return fail(mapSupabaseError(error));
    return ok(
      data.map((r) => ({
        at: r.created_at,
        kind: r.kind as AccessKind,
        clientName: r.client_name,
        userEmail: r.user_email ?? '—',
        userRole: r.user_role ?? '',
      }))
    );
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
