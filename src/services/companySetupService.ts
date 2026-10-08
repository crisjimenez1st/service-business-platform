import type { BusinessType, CurrencyCode } from '../types';
import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';

/**
 * Crea la empresa del usuario autenticado (RPC create_company_for_current_user).
 * La RPC no recibe moneda (el default de la base es córdobas): si se
 * eligió otra, se aplica enseguida con setCompanyCurrency (el owner puede
 * actualizar su empresa por RLS). `currencyApplied` = false si ese segundo
 * paso falló: la empresa ya existe y la moneda se corrige en Configuración.
 */
export async function createCompany(
  name: string,
  businessType: BusinessType,
  currency: CurrencyCode = 'NIO'
): Promise<ServiceResult<{ id: string; currencyApplied: boolean }>> {
  try {
    const { data, error } = await supabase.rpc('create_company_for_current_user', {
      p_company_name: name,
      p_business_type: businessType,
    });
    if (error) return fail(mapSupabaseError(error));
    if (currency === 'NIO') return ok({ id: data, currencyApplied: true });
    const applied = await setCompanyCurrency(data, currency);
    return ok({ id: data, currencyApplied: !applied.error });
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/**
 * Cambia la moneda por defecto de la empresa (solo owner, por RLS). Solo
 * afecta a los trabajos NUEVOS: cada trabajo conserva la moneda con la
 * que se creó.
 */
export async function setCompanyCurrency(companyId: string, currency: CurrencyCode): Promise<ServiceResult<null>> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .update({ currency })
      .eq('id', companyId)
      .select('id')
      .maybeSingle();
    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'forbidden', message: 'No pudimos cambiar la moneda.' });
    return ok(null);
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

/** Cambia el nombre de la clínica o del médico (solo owner, por RLS). */
export async function setCompanyName(companyId: string, name: string): Promise<ServiceResult<null>> {
  const clean = name.trim();
  if (clean.length < 2) return fail({ kind: 'unknown', message: 'Escribe un nombre de al menos 2 letras.' });
  try {
    const { data, error } = await supabase
      .from('companies')
      .update({ name: clean })
      .eq('id', companyId)
      .select('id')
      .maybeSingle();
    if (error) return fail(mapSupabaseError(error));
    if (!data) return fail({ kind: 'forbidden', message: 'No pudimos cambiar el nombre.' });
    return ok(null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Cambia la contraseña de quien tiene la sesión abierta, verificando antes la actual. */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<ServiceResult<null>> {
  if (newPassword.length < 8) return fail({ kind: 'unknown', message: 'La contraseña nueva debe tener al menos 8 caracteres.' });
  try {
    const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (check.error) return fail({ kind: 'unknown', message: 'La contraseña actual no es correcta.' });
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return fail(mapSupabaseError(error));
    return ok(null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
