/** Plan de OneFlow Med: precio, prueba y contacto para activarlo. */
export const PLAN_PRICE_USD = 9.99;
export const TRIAL_DAYS = 30;
/** Número de WhatsApp (solo dígitos, con código de país) al que escriben para activar el plan. Vacío = no se muestra el botón. */
export const BILLING_WHATSAPP = '';

export type PlanState =
  | { kind: 'paid' }
  | { kind: 'trial'; daysLeft: number }
  | { kind: 'expired'; daysAgo: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export function getPlanState(trialEndsAt: string | null, paidUntil: string | null, now: Date = new Date()): PlanState {
  if (paidUntil && new Date(paidUntil).getTime() > now.getTime()) return { kind: 'paid' };
  const end = trialEndsAt ? new Date(trialEndsAt).getTime() : 0;
  if (end > now.getTime()) return { kind: 'trial', daysLeft: Math.ceil((end - now.getTime()) / DAY_MS) };
  return { kind: 'expired', daysAgo: Math.floor((now.getTime() - end) / DAY_MS) };
}
