import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { Button, Card, ErrorState } from '../ui';
import NewPlanSheet from './NewPlanSheet';
import PlanPaymentSheet from './PlanPaymentSheet';
import PlanCard from './PlanCard';
import VoidPaymentModal from '../payments/VoidPaymentModal';
import { createPlan, getClientPlans, recordPlanPayment, setPlanStatus, voidPlanPayment } from '../../services/planService';
import type { ServiceError } from '../../services/errors/serviceError';
import type { CurrencyCode, PlanPayment, TreatmentPlan, TreatmentPlanStatus } from '../../types';

interface PlansPanelProps {
  companyId: string;
  clientId: string;
  currency: CurrencyCode;
  timezone: string;
}

/** Planes de tratamiento de un paciente: lista, nuevo plan, abonos y estado. Solo dueño y recepción. */
export default function PlansPanel({ companyId, clientId, currency, timezone }: PlansPanelProps) {
  const [plans, setPlans] = useState<TreatmentPlan[] | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [payingPlan, setPayingPlan] = useState<TreatmentPlan | null>(null);
  const [voiding, setVoiding] = useState<{ plan: TreatmentPlan; payment: PlanPayment } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await getClientPlans(companyId, clientId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setPlans(result.data);
  }, [companyId, clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getClientPlans(companyId, clientId);
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setPlans(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, clientId]);

  async function handleStatus(plan: TreatmentPlan, status: TreatmentPlanStatus) {
    setActionError(null);
    const result = await setPlanStatus(plan.id, status);
    if (result.error) setActionError(result.error.message);
    await reload();
  }

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (plans === null) return <p className="text-center text-sm text-slate-500 py-8">Cargando…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Planes de tratamiento</h2>
        <Button size="sm" icon={<Plus size={16} />} onClick={() => setNewOpen(true)}>
          Nuevo plan
        </Button>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {actionError}
        </p>
      )}

      {plans.length === 0 ? (
        <Card>
          <div className="text-center py-4">
            <ClipboardList size={32} className="mx-auto text-brand-600" />
            <p className="text-sm font-medium text-slate-900 mt-2">Sin planes de tratamiento</p>
            <p className="text-sm text-slate-500 mt-1">
              Para tratamientos de varias visitas (ortodoncia, implantes...), crea un plan y registra los abonos del paciente.
            </p>
          </div>
        </Card>
      ) : (
        plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            timezone={timezone}
            onAddPayment={setPayingPlan}
            onVoidPayment={(pl, pay) => setVoiding({ plan: pl, payment: pay })}
            onChangeStatus={handleStatus}
          />
        ))
      )}

      {newOpen && (
        <NewPlanSheet
          open
          currency={currency}
          onClose={() => setNewOpen(false)}
          onSubmit={async (v) => {
            const result = await createPlan(companyId, {
              clientId,
              name: v.name,
              total: v.total,
              description: v.description,
              initialPayment: v.initialPayment,
              method: v.method,
            });
            if (result.error) return result.error.message;
            await reload();
            return null;
          }}
        />
      )}

      {payingPlan && (
        <PlanPaymentSheet
          open
          planName={payingPlan.name}
          currency={payingPlan.currency}
          timezone={timezone}
          balance={Math.round((payingPlan.total - payingPlan.paidAmount) * 100) / 100}
          onClose={() => setPayingPlan(null)}
          onSubmit={async (v) => {
            const result = await recordPlanPayment(payingPlan.id, v);
            if (result.error) return result.error.message;
            await reload();
            return null;
          }}
        />
      )}

      {voiding && (
        <VoidPaymentModal
          open
          amount={voiding.payment.amount}
          currency={voiding.plan.currency}
          onClose={() => setVoiding(null)}
          onConfirm={async (reason) => {
            const result = await voidPlanPayment(voiding.payment.id, reason);
            if (result.error) return result.error.message;
            await reload();
            return null;
          }}
        />
      )}
    </div>
  );
}
