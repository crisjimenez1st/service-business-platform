import type { JobDraft } from '../types';
import { supabase } from '../lib/supabase';
import { jobDraftRowToDomain } from './mappers/quoteMapper';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

/**
 * jobDraftService: migrado a Supabase. La creación pasa EXCLUSIVAMENTE
 * por la RPC create_job_draft (migración 006) -- nunca un insert
 * directo desde el frontend -- porque esa RPC es quien valida que la
 * Quote esté `accepted` y garantiza idempotencia real por quote_id
 * (constraint unique + re-consulta ante condición de carrera). Las
 * lecturas sí son queries directas: son de solo lectura, protegidas
 * por RLS (`job_drafts_select`), sin necesidad de transacción.
 */

export interface CreateJobDraftInput {
  companyId: string;
  clientId: string;
  quoteId: string;
  title: string;
  description?: string;
}

/**
 * Idempotente por quote_id: si ya existe un JobDraft para esta
 * cotización, create_job_draft (SQL) devuelve el id existente en vez
 * de crear uno nuevo -- la garantía vive en el servidor (constraint +
 * RPC), no en que el frontend recuerde no llamar dos veces.
 */
export async function createJobDraft(input: CreateJobDraftInput): Promise<ServiceResult<JobDraft>> {
  try {
    const { data: jobDraftId, error: rpcError } = await supabase.rpc('create_job_draft', {
      p_quote_id: input.quoteId,
      p_title: input.title,
      p_description: input.description ?? null,
    });

    if (rpcError) return fail(mapSupabaseError(rpcError));
    return getJobDraftById(input.companyId, jobDraftId);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function getJobDraftById(
  companyId: string,
  id: string
): Promise<ServiceResult<JobDraft>> {
  try {
    const { data, error } = await supabase
      .from('job_drafts')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos esa orden de trabajo preparada.' });
    return ok(jobDraftRowToDomain(data));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function getJobDraftByQuoteId(
  companyId: string,
  quoteId: string
): Promise<ServiceResult<JobDraft | null>> {
  try {
    const { data, error } = await supabase
      .from('job_drafts')
      .select('*')
      .eq('quote_id', quoteId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) return fail(mapSupabaseError(error));
    return ok(data ? jobDraftRowToDomain(data) : null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function getJobDrafts(companyId: string): Promise<ServiceResult<JobDraft[]>> {
  try {
    const { data, error } = await supabase
      .from('job_drafts')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(jobDraftRowToDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
