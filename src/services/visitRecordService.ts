import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import { mapAgendaError } from './errors/agendaError';
import type { VisitRecord, VisitRecordInput } from '../types';
import type { Database } from '../types/database.types';

type Row = Database['public']['Tables']['visit_records']['Row'];

function toDomain(r: Row): VisitRecord {
  return {
    jobId: r.job_id,
    clientId: r.client_id,
    reason: r.reason ?? undefined,
    diagnosis: r.diagnosis ?? undefined,
    treatment: r.treatment ?? undefined,
    prescription: r.prescription ?? undefined,
    nextSteps: r.next_steps ?? undefined,
    updatedAt: r.updated_at,
  };
}

/** Registro de una cita (null si todavía no se ha escrito). La recepción no tiene acceso: recibirá null. */
export async function getVisitRecord(jobId: string): Promise<ServiceResult<VisitRecord | null>> {
  try {
    const { data, error } = await supabase.from('visit_records').select('*').eq('job_id', jobId).maybeSingle();
    if (error) return fail(mapSupabaseError(error));
    return ok(data ? toDomain(data) : null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Registros de todas las atenciones de un paciente, indexados por cita. */
export async function getClientVisitRecords(companyId: string, clientId: string): Promise<ServiceResult<Record<string, VisitRecord>>> {
  try {
    const { data, error } = await supabase
      .from('visit_records')
      .select('*')
      .eq('company_id', companyId)
      .eq('client_id', clientId);
    if (error) return fail(mapSupabaseError(error));
    const map: Record<string, VisitRecord> = {};
    data.forEach((r) => (map[r.job_id] = toDomain(r)));
    return ok(map);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Guarda (crea o reemplaza) el registro de la atención. Solo dueño y doctores. */
export async function saveVisitRecord(jobId: string, input: VisitRecordInput): Promise<ServiceResult<VisitRecord>> {
  try {
    const { data, error } = await supabase.rpc('save_visit_record', {
      p_job_id: jobId,
      p_reason: input.reason ?? null,
      p_diagnosis: input.diagnosis ?? null,
      p_treatment: input.treatment ?? null,
      p_prescription: input.prescription ?? null,
      p_next_steps: input.nextSteps ?? null,
    });
    if (error) return fail(mapAgendaError(error));
    return ok(toDomain(data));
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}
