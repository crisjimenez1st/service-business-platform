import { supabase } from '../lib/supabase';
import { mapSupabaseError, ok, fail, type ServiceResult } from './errors/serviceError';
import { mapAgendaError } from './errors/agendaError';
import type { PlanPayment, TreatmentPlan, TreatmentPlanStatus } from '../types';
import type { Database } from '../types/database.types';

type PlanRow = Database['public']['Tables']['treatment_plans']['Row'];
type PaymentRow = Database['public']['Tables']['plan_payments']['Row'];

function paymentToDomain(r: PaymentRow): PlanPayment {
  return {
    id: r.id,
    planId: r.plan_id,
    amount: Number(r.amount),
    method: r.method,
    paidAt: r.paid_at,
    note: r.note ?? undefined,
    voidedAt: r.voided_at ?? undefined,
    voidReason: r.void_reason ?? undefined,
  };
}

function planToDomain(r: PlanRow, payments: PaymentRow[]): TreatmentPlan {
  return {
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    description: r.description ?? undefined,
    total: Number(r.total),
    paidAmount: Number(r.paid_amount),
    currency: r.currency === 'USD' ? 'USD' : 'NIO',
    status: r.status as TreatmentPlanStatus,
    createdAt: r.created_at,
    payments: payments
      .filter((p) => p.plan_id === r.id)
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
      .map(paymentToDomain),
  };
}

async function loadPlans(companyId: string, clientId?: string): Promise<ServiceResult<TreatmentPlan[]>> {
  try {
    let q = supabase.from('treatment_plans').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (clientId) q = q.eq('client_id', clientId);
    const plans = await q;
    if (plans.error) return fail(mapSupabaseError(plans.error));
    if (plans.data.length === 0) return ok([]);
    const pays = await supabase
      .from('plan_payments')
      .select('*')
      .in('plan_id', plans.data.map((p) => p.id));
    if (pays.error) return fail(mapSupabaseError(pays.error));
    return ok(plans.data.map((p) => planToDomain(p, pays.data)));
  } catch (err) {
    return fail(mapSupabaseError(err));
  }
}

/** Planes de un paciente, con sus abonos. Solo dueño y recepción. */
export function getClientPlans(companyId: string, clientId: string) {
  return loadPlans(companyId, clientId);
}

/** Todos los planes de la clínica (para ver los que tienen saldo). */
export function getCompanyPlans(companyId: string) {
  return loadPlans(companyId);
}

export interface NewPlanInput {
  clientId: string;
  name: string;
  total: number;
  description?: string;
  initialPayment?: number;
  method?: string;
}

export async function createPlan(companyId: string, input: NewPlanInput): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('create_treatment_plan', {
      p_company_id: companyId,
      p_client_id: input.clientId,
      p_name: input.name,
      p_total: input.total,
      p_description: input.description ?? null,
      p_initial_payment: input.initialPayment ?? null,
      p_method: input.method ?? 'cash',
    });
    if (error) return fail(mapAgendaError(error));
    return ok(null);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

export async function recordPlanPayment(
  planId: string,
  input: { amount: number; method: string; paidAt: string; note?: string }
): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('record_plan_payment', {
      p_plan_id: planId,
      p_amount: input.amount,
      p_method: input.method,
      p_paid_at: input.paidAt,
      p_note: input.note ?? null,
    });
    if (error) return fail(mapAgendaError(error));
    return ok(null);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

export async function voidPlanPayment(paymentId: string, reason: string): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('void_plan_payment', { p_payment_id: paymentId, p_void_reason: reason });
    if (error) return fail(mapAgendaError(error));
    return ok(null);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}

export async function setPlanStatus(planId: string, status: TreatmentPlanStatus): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('set_treatment_plan_status', { p_plan_id: planId, p_status: status });
    if (error) return fail(mapAgendaError(error));
    return ok(null);
  } catch (err) {
    return fail(mapAgendaError(err));
  }
}
