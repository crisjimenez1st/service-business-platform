import type { BusinessType } from '../types';
import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

/** Crea la empresa del usuario autenticado (RPC create_company_for_current_user). Devuelve el id. */
export async function createCompany(name: string, businessType: BusinessType): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.rpc('create_company_for_current_user', {
      p_company_name: name,
      p_business_type: businessType,
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(data);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Cambia el tipo de negocio (solo owner; lo valida la RPC). Solo cambia vocabulario y menú. */
export async function setBusinessType(companyId: string, businessType: BusinessType): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('set_company_business_type', {
      p_company_id: companyId,
      p_business_type: businessType,
    });
    if (error) return fail(mapSupabaseError(error));
    return ok(null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
