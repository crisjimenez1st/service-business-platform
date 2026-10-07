import type { ServiceRule } from '../types';
import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import { mapAgendaError } from './errors/agendaError';

/**
 * Reglas de regreso por servicio. CRUD directo sobre
 * service_followup_rules: la protección real es RLS (owner/office).
 */

type RuleRow = {
  id: string;
  service_name: string;
  months: number;
  reason: string | null;
};

function toDomain(r: RuleRow): ServiceRule {
  return { id: r.id, serviceName: r.service_name, months: r.months, reason: r.reason ?? '' };
}

/** Misma normalización que service_key en SQL: sin tildes, minúsculas, espacios colapsados. */
export function normalizeServiceKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Regla que corresponde al servicio de una cita, o undefined si no hay. */
export function findRuleForService(rules: ServiceRule[], serviceType: string): ServiceRule | undefined {
  const key = normalizeServiceKey(serviceType);
  return rules.find((r) => normalizeServiceKey(r.serviceName) === key);
}

export async function getServiceRules(companyId: string): Promise<ServiceResult<ServiceRule[]>> {
  try {
    const { data, error } = await supabase
      .from('service_followup_rules')
      .select('id, service_name, months, reason')
      .eq('company_id', companyId)
      .order('service_name', { ascending: true });
    if (error) return fail(mapSupabaseError(error));
    return ok(data.map(toDomain));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

export async function createServiceRule(
  companyId: string,
  input: { serviceName: string; months: number; reason?: string }
): Promise<ServiceResult<ServiceRule>> {
  try {
    const { data, error } = await supabase
      .from('service_followup_rules')
      .insert({
        company_id: companyId,
        service_name: input.serviceName.trim(),
        months: input.months,
        reason: input.reason?.trim() || null,
      })
      .select('id, service_name, months, reason')
      .single();
    if (error) return fail(mapAgendaError(error));
    return ok(toDomain(data));
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

export async function updateServiceRule(
  companyId: string,
  id: string,
  input: { serviceName: string; months: number; reason?: string }
): Promise<ServiceResult<ServiceRule>> {
  try {
    const { data, error } = await supabase
      .from('service_followup_rules')
      .update({
        service_name: input.serviceName.trim(),
        months: input.months,
        reason: input.reason?.trim() || null,
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id, service_name, months, reason')
      .maybeSingle();
    if (error) return fail(mapAgendaError(error));
    if (!data) return fail({ kind: 'not_found', message: 'No encontramos esa regla.' });
    return ok(toDomain(data));
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

export async function deleteServiceRule(companyId: string, id: string): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.from('service_followup_rules').delete().eq('id', id).eq('company_id', companyId);
    if (error) return fail(mapSupabaseError(error));
    return ok(null);
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
