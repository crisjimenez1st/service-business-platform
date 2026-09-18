import type { MyAssignedJob } from '../types';
import { supabase } from '../lib/supabase';
import { myAssignedJobRowToDomain } from './mappers/jobMapper';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

/**
 * technicianJobService: única superficie de acceso a Jobs para el rol
 * technician (Fase 3, Bloques 2 y 4). Deliberadamente separado de
 * jobService.ts -- nunca debe crecer hacia una consulta directa sobre
 * la tabla jobs, porque no existe ninguna policy de SELECT/UPDATE para
 * technician ahí (ver 008_technician_access.sql): la única lectura
 * posible es vía get_my_assigned_jobs(), la única escritura vía
 * update_job_as_technician().
 */

export async function getMyAssignedJobs(): Promise<ServiceResult<MyAssignedJob[]>> {
  try {
    const { data, error } = await supabase.rpc('get_my_assigned_jobs');
    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(myAssignedJobRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Único camino de escritura de un técnico sobre un Job. La transición
 * de estado se valida en el servidor (tabla fija de transiciones
 * permitidas, ver update_job_as_technician en 008_technician_access.sql)
 * -- este servicio nunca reimplementa esa validación, solo llama a la
 * RPC y confía en su respuesta.
 */
export async function updateJobAsTechnician(
  jobId: string,
  newStatus?: string,
  notes?: string
): Promise<ServiceResult<{ id: string; status: string; notes: string | null; updatedAt: string }>> {
  try {
    const { data, error } = await supabase.rpc('update_job_as_technician', {
      p_job_id: jobId,
      p_new_status: newStatus ?? null,
      p_notes: notes ?? null,
    });
    if (error) return fail(mapSupabaseError(error));
    const row = data[0];
    if (!row) return fail({ kind: 'not_found', message: 'No pudimos actualizar el trabajo.' });
    return ok({ id: row.id, status: row.status, notes: row.notes, updatedAt: row.updated_at });
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
