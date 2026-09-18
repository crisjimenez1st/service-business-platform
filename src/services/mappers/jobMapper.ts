import type { Job, JobStatus, MyAssignedJob, CompanyTechnician } from '../../types';
import type { Database } from '../../types/database.types';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type MyAssignedJobRow = Database['public']['Functions']['get_my_assigned_jobs']['Returns'][number];
type CompanyTechnicianRow = Database['public']['Functions']['get_company_technicians']['Returns'][number];

/**
 * Traduce una fila de jobs (snake_case) al tipo de dominio Job
 * (camelCase). Sin mapper inverso: toda escritura pasa por las RPCs
 * transaccionales (createJobFromJobDraft, assignJobTechnician,
 * scheduleJob) -- mismo criterio ya usado en quoteMapper, donde
 * create/update no usan un "insert row" directo.
 */
export function jobRowToDomain(row: JobRow): Job {
  return {
    id: row.id,
    companyId: row.company_id,
    clientId: row.client_id,
    quoteId: row.quote_id ?? undefined,
    jobDraftId: row.job_draft_id ?? undefined,
    assignedTechnicianId: row.assigned_technician_id ?? undefined,
    serviceType: row.service_type,
    description: row.description ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status as JobStatus,
    scheduledStartAt: row.scheduled_start_at ?? undefined,
    scheduledEndAt: row.scheduled_end_at ?? undefined,
    address: row.address ?? undefined,
    mapsUrl: row.maps_url ?? undefined,
    total: row.total ?? undefined,
    paidAmount: row.paid_amount ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
    cancellationCategory: row.cancellation_category ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelledBy: row.cancelled_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Traduce una fila del RPC get_my_assigned_jobs al tipo de dominio
 * MyAssignedJob -- mapper separado a propósito del de arriba, mismo
 * criterio que quoteMapper distingue quoteRowToDomain de
 * publicQuoteRowToView: son dos mundos de datos distintos (uno con
 * todas las columnas para admin, otro con la superficie limitada de
 * un técnico) y mezclarlos facilitaría filtrar un campo privado por
 * accidente.
 */
export function myAssignedJobRowToDomain(row: MyAssignedJobRow): MyAssignedJob {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientWhatsapp: row.client_whatsapp ?? undefined,
    serviceType: row.service_type,
    description: row.description ?? undefined,
    status: row.status as JobStatus,
    scheduledStartAt: row.scheduled_start_at ?? undefined,
    scheduledEndAt: row.scheduled_end_at ?? undefined,
    address: row.address ?? undefined,
    mapsUrl: row.maps_url ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function companyTechnicianRowToDomain(row: CompanyTechnicianRow): CompanyTechnician {
  return {
    userId: row.user_id,
    displayName: row.display_name ?? row.email ?? 'Técnico',
    email: row.email ?? '',
  };
}
