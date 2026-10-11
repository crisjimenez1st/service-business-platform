import type { ClinicService } from '../types';
import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import type { Database } from '../types/database.types';

type Row = Database['public']['Tables']['clinic_services']['Row'];

export interface ClinicServiceInput {
  name: string;
  category?: string;
  price?: number;
  active?: boolean;
}

function toDomain(r: Row): ClinicService {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? undefined,
    price: r.price === null ? undefined : Number(r.price),
    active: r.active,
  };
}

const DUPLICATE = 'Ya tienes un servicio con ese nombre.';

function mapError(err: unknown) {
  const e = mapSupabaseError(err);
  const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: string }).code : '';
  return code === '23505' ? { ...e, message: DUPLICATE } : e;
}

export async function getClinicServices(companyId: string): Promise<ServiceResult<ClinicService[]>> {
  try {
    const { data, error } = await supabase
      .from('clinic_services')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(toDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function createClinicService(companyId: string, input: ClinicServiceInput): Promise<ServiceResult<ClinicService>> {
  try {
    const { data, error } = await supabase
      .from('clinic_services')
      .insert({
        company_id: companyId,
        name: input.name.trim(),
        category: input.category?.trim() || null,
        price: input.price ?? null,
        active: input.active ?? true,
      })
      .select('*')
      .single();
    if (error) return fail(mapError(error));
    return ok(toDomain(data));
  } catch (err) {
    return fail(mapError(err));
  }
}

export async function updateClinicService(companyId: string, id: string, input: ClinicServiceInput): Promise<ServiceResult<ClinicService>> {
  try {
    const { data, error } = await supabase
      .from('clinic_services')
      .update({
        name: input.name.trim(),
        category: input.category?.trim() || null,
        price: input.price ?? null,
        active: input.active ?? true,
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return fail(mapError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos ese servicio.' });
    return ok(toDomain(data));
  } catch (err) {
    return fail(mapError(err));
  }
}

export async function deleteClinicService(companyId: string, id: string): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.from('clinic_services').delete().eq('id', id).eq('company_id', companyId);
    if (error) return fail(mapSupabaseError(error));
    return ok(null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
