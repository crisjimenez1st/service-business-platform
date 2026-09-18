import type { Job, CompanyTechnician } from '../types';
import { supabase } from '../lib/supabase';
import { jobRowToDomain, companyTechnicianRowToDomain } from './mappers/jobMapper';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

/**
 * jobService: CRUD real sobre Supabase para owner/office (Fase 3,
 * Bloque 4). Las lecturas son queries directas protegidas por RLS
 * (policies jobs_select_admin de 007_jobs_schema.sql); toda escritura
 * pasa por las RPCs transaccionales del Bloque 3
 * (create_job_from_job_draft, assign_job_technician, schedule_job) --
 * nunca un INSERT/UPDATE directo sobre jobs desde este servicio.
 *
 * Nota de nombres: existe también technicianJobService.ts, que expone
 * get_my_assigned_jobs()/update_job_as_technician() para el rol
 * technician -- deliberadamente separado de este archivo, mismo
 * criterio que quoteService distingue las funciones administrativas de
 * las públicas: la superficie de lectura de un técnico nunca debe
 * poder crecer por accidente hacia las columnas completas de jobs.
 */

export async function getJobs(companyId: string): Promise<ServiceResult<Job[]>> {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('company_id', companyId)
      .order('scheduled_start_at', { ascending: true, nullsFirst: false });

    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(jobRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Jobs cuyo scheduled_start_at cae dentro de [rangeStartIso, rangeEndIso)
 * -- usado por las vistas Mes/Semana/Día del calendario para no traer
 * el histórico completo de la empresa de golpe. Los Jobs sin programar
 * (scheduled_start_at null) NUNCA se incluyen aquí -- se cargan aparte
 * vía getUnscheduledJobs, para que nunca desaparezcan silenciosamente
 * de la UI por quedar fuera de cualquier rango de fechas.
 */
export async function getJobsInRange(
  companyId: string,
  rangeStartIso: string,
  rangeEndIso: string
): Promise<ServiceResult<Job[]>> {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('company_id', companyId)
      .gte('scheduled_start_at', rangeStartIso)
      .lt('scheduled_start_at', rangeEndIso)
      .order('scheduled_start_at', { ascending: true });

    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(jobRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Jobs sin programar (status='new', scheduled_start_at null) -- mostrados siempre, nunca ocultos por caer fuera de un rango. */
export async function getUnscheduledJobs(companyId: string): Promise<ServiceResult<Job[]>> {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('company_id', companyId)
      .is('scheduled_start_at', null)
      .order('created_at', { ascending: false });

    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(jobRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function getJobById(companyId: string, id: string): Promise<ServiceResult<Job>> {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos ese trabajo.' });
    return ok(jobRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Técnicos activos de la empresa, para el selector de asignación -- ver get_company_technicians (migración 010): único camino seguro, profiles no permite SELECT de otro usuario. */
export async function getActiveTechnicians(companyId: string): Promise<ServiceResult<CompanyTechnician[]>> {
  try {
    const { data, error } = await supabase.rpc('get_company_technicians', { p_company_id: companyId });
    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(companyTechnicianRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Jobs reales de un cliente, para su historial en ClientProfilePage -- ver JobHistoryCard. Ordenados por fecha de creación descendente. */
export async function getClientJobs(companyId: string, clientId: string): Promise<ServiceResult<Job[]>> {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('company_id', companyId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(jobRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

// ---------- Escritura (siempre vía RPC transaccional) ----------

export async function createJobFromJobDraft(
  companyId: string,
  jobDraftId: string,
  assignedTechnicianId?: string
): Promise<ServiceResult<Job>> {
  try {
    const { data, error } = await supabase.rpc('create_job_from_job_draft', {
      p_job_draft_id: jobDraftId,
      p_assigned_technician_id: assignedTechnicianId ?? null,
    });
    if (error) return fail(mapSupabaseError(error));
    return getJobById(companyId, data.id);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function assignJobTechnician(
  jobId: string,
  technicianId: string | null
): Promise<ServiceResult<Job>> {
  try {
    const { data, error } = await supabase.rpc('assign_job_technician', {
      p_job_id: jobId,
      p_technician_id: technicianId,
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(jobRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Única autoridad de scheduled_start_at/scheduled_end_at y de la
 * transición new<->scheduled (ver schedule_job, migración 009).
 * scheduledStartAt=undefined desprograma (vuelve a 'new'); con valor,
 * programa o reprograma (pasa/queda en 'scheduled').
 */
export async function scheduleJob(
  jobId: string,
  scheduledStartAt: string | null,
  scheduledEndAt: string | null = null
): Promise<ServiceResult<Job>> {
  try {
    const { data, error } = await supabase.rpc('schedule_job', {
      p_job_id: jobId,
      p_scheduled_start_at: scheduledStartAt,
      p_scheduled_end_at: scheduledEndAt,
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(jobRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Cancela un Job (owner/office), con motivo obligatorio -- ver
 * cancel_job (migración 011). Permitido desde
 * new/scheduled/en_route/in_progress/paused; rechazado en
 * completed/cancelled. El Job nunca se borra, queda con su auditoría
 * completa (cancelledAt/cancelledBy).
 */
export async function cancelJob(
  jobId: string,
  reason: string,
  category?: string
): Promise<ServiceResult<Job>> {
  try {
    const { data, error } = await supabase.rpc('cancel_job', {
      p_job_id: jobId,
      p_reason: reason,
      p_category: category ?? null,
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(jobRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Avanza el estado de un Job un paso (owner/office), sobre cualquier
 * Job de la empresa -- ver advance_job_status (migración 011). Misma
 * tabla de transiciones de un paso que usa el técnico; nunca permite
 * saltos arbitrarios. La programación (new<->scheduled) sigue siendo
 * exclusiva de scheduleJob, no de esta función.
 */
export async function advanceJobStatus(jobId: string, newStatus: string): Promise<ServiceResult<Job>> {
  try {
    const { data, error } = await supabase.rpc('advance_job_status', {
      p_job_id: jobId,
      p_new_status: newStatus,
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(jobRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
