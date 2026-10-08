import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import type { CurrencyCode } from '../types';

export interface MonthIncome {
  /** Dinero cobrado en el mes por moneda (pagos de citas + abonos de planes, sin anulados). */
  byCurrency: Partial<Record<CurrencyCode, number>>;
}

const CHUNK = 150;

function cur(c: string): CurrencyCode {
  return c === 'USD' ? 'USD' : 'NIO';
}

/** Dinero cobrado entre dos fechas. Solo dueño y recepción (RLS); para otros roles devuelve 0. */
export async function getIncomeInRange(companyId: string, startIso: string, endIso: string): Promise<ServiceResult<MonthIncome>> {
  try {
    const byCurrency: Partial<Record<CurrencyCode, number>> = {};
    const add = (c: CurrencyCode, amount: number) => {
      byCurrency[c] = Math.round(((byCurrency[c] ?? 0) + amount) * 100) / 100;
    };

    // Pagos de citas: la moneda vive en la cita.
    const pays = await supabase
      .from('payments')
      .select('job_id, amount')
      .eq('company_id', companyId)
      .is('voided_at', null)
      .gte('paid_at', startIso)
      .lt('paid_at', endIso);
    if (pays.error) return fail(mapSupabaseError(pays.error));
    const jobIds = [...new Set(pays.data.map((p) => p.job_id))];
    const jobCurrency = new Map<string, CurrencyCode>();
    for (let i = 0; i < jobIds.length; i += CHUNK) {
      const jobs = await supabase.from('jobs').select('id, currency').in('id', jobIds.slice(i, i + CHUNK));
      if (jobs.error) return fail(mapSupabaseError(jobs.error));
      jobs.data.forEach((j) => jobCurrency.set(j.id, cur(j.currency)));
    }
    pays.data.forEach((p) => add(jobCurrency.get(p.job_id) ?? 'NIO', Number(p.amount)));

    // Abonos de planes: la moneda vive en el plan.
    const planPays = await supabase
      .from('plan_payments')
      .select('plan_id, amount')
      .eq('company_id', companyId)
      .is('voided_at', null)
      .gte('paid_at', startIso)
      .lt('paid_at', endIso);
    if (planPays.error) return fail(mapSupabaseError(planPays.error));
    const planIds = [...new Set(planPays.data.map((p) => p.plan_id))];
    const planCurrency = new Map<string, CurrencyCode>();
    for (let i = 0; i < planIds.length; i += CHUNK) {
      const plans = await supabase.from('treatment_plans').select('id, currency').in('id', planIds.slice(i, i + CHUNK));
      if (plans.error) return fail(mapSupabaseError(plans.error));
      plans.data.forEach((p) => planCurrency.set(p.id, cur(p.currency)));
    }
    planPays.data.forEach((p) => add(planCurrency.get(p.plan_id) ?? 'NIO', Number(p.amount)));

    return ok({ byCurrency });
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}
