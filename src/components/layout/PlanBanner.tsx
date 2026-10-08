import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { BILLING_WHATSAPP, PLAN_PRICE_USD, getPlanState } from '../../config/plan';
import { buildWhatsAppLink } from '../../utils/whatsapp';

/** Aviso de prueba gratis por vencer o vencida. Solo lo ve el dueño. No bloquea nada. */
export default function PlanBanner() {
  const { company } = useCurrentCompany();
  if (!company || company.role !== 'owner') return null;
  const plan = getPlanState(company.trialEndsAt, company.paidUntil);
  if (plan.kind === 'paid' || (plan.kind === 'trial' && plan.daysLeft > 7)) return null;

  const expired = plan.kind === 'expired';
  const text = expired
    ? `Tu prueba gratis terminó. El plan cuesta US$${PLAN_PRICE_USD} al mes.`
    : `Tu prueba gratis termina en ${plan.daysLeft} ${plan.daysLeft === 1 ? 'día' : 'días'}. El plan cuesta US$${PLAN_PRICE_USD} al mes.`;

  return (
    <div
      className={[
        'rounded-xl px-4 py-3 mb-4 text-sm flex flex-wrap items-center justify-between gap-2',
        expired ? 'bg-amber-50 text-amber-900' : 'bg-brand-50 text-brand-800',
      ].join(' ')}
    >
      <span>{text}</span>
      {BILLING_WHATSAPP && (
        <a
          href={buildWhatsAppLink(BILLING_WHATSAPP, `Hola, quiero activar el plan de OneFlow Med para ${company.name}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
        >
          Activar plan
        </a>
      )}
    </div>
  );
}
