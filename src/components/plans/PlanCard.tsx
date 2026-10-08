import { Badge, Button, Card } from '../ui';
import { formatCurrency } from '../../utils/currency';
import { PAYMENT_METHOD_LABELS } from '../../utils/paymentStatus';
import { formatLongDateInTimezone } from '../../utils/timezone';
import type { PaymentMethod, PlanPayment, TreatmentPlan, TreatmentPlanStatus } from '../../types';

interface PlanCardProps {
  plan: TreatmentPlan;
  timezone: string;
  onAddPayment: (plan: TreatmentPlan) => void;
  onVoidPayment: (plan: TreatmentPlan, payment: PlanPayment) => void;
  onChangeStatus: (plan: TreatmentPlan, status: TreatmentPlanStatus) => void;
}

const STATUS_LABEL: Record<TreatmentPlanStatus, string> = {
  active: 'En tratamiento',
  completed: 'Terminado',
  cancelled: 'Cancelado',
};
const STATUS_TONE: Record<TreatmentPlanStatus, 'info' | 'success' | 'danger'> = {
  active: 'info',
  completed: 'success',
  cancelled: 'danger',
};

/** Un plan de tratamiento: avance de pago, abonos y acciones. */
export default function PlanCard({ plan, timezone, onAddPayment, onVoidPayment, onChangeStatus }: PlanCardProps) {
  const balance = Math.max(0, Math.round((plan.total - plan.paidAmount) * 100) / 100);
  const pct = Math.min(100, Math.round((plan.paidAmount / plan.total) * 100));
  const active = plan.payments.filter((p) => !p.voidedAt);

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{plan.name}</h3>
          <p className="text-xs text-slate-500">Iniciado el {formatLongDateInTimezone(plan.createdAt, timezone)}</p>
        </div>
        <Badge tone={STATUS_TONE[plan.status]}>{STATUS_LABEL[plan.status]}</Badge>
      </div>

      {plan.description && <p className="text-sm text-slate-600 whitespace-pre-line">{plan.description}</p>}

      <div>
        <div className="flex items-end justify-between gap-3 text-sm">
          <span className="text-slate-500">
            Pagado <span className="font-semibold text-slate-900">{formatCurrency(plan.paidAmount, plan.currency)}</span> de{' '}
            {formatCurrency(plan.total, plan.currency)}
          </span>
          <span className={balance > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
            {balance > 0 ? `Falta ${formatCurrency(balance, plan.currency)}` : 'Pagado completo'}
          </span>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {plan.payments.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Abonos</p>
          <ul className="divide-y divide-slate-100">
            {plan.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className={['text-sm', p.voidedAt ? 'text-slate-400 line-through' : 'text-slate-900 font-medium'].join(' ')}>
                    {formatCurrency(p.amount, plan.currency)}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {formatLongDateInTimezone(p.paidAt, timezone)} · {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                    {p.note ? ` · ${p.note}` : ''}
                  </p>
                  {p.voidedAt && <p className="text-xs text-red-600">Anulado: {p.voidReason}</p>}
                </div>
                {!p.voidedAt && (
                  <button
                    type="button"
                    onClick={() => onVoidPayment(plan, p)}
                    className="text-xs font-medium text-slate-500 hover:text-red-700 min-h-9 px-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    Anular
                  </button>
                )}
              </li>
            ))}
          </ul>
          {active.length === 0 && <p className="text-xs text-slate-500">Todos los abonos están anulados.</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {plan.status !== 'cancelled' && balance > 0 && (
          <Button size="sm" onClick={() => onAddPayment(plan)}>
            Registrar abono
          </Button>
        )}
        {plan.status === 'active' && (
          <Button size="sm" variant="secondary" onClick={() => onChangeStatus(plan, 'completed')}>
            Marcar como terminado
          </Button>
        )}
        {plan.status === 'active' && (
          <Button size="sm" variant="danger" onClick={() => onChangeStatus(plan, 'cancelled')}>
            Cancelar plan
          </Button>
        )}
        {plan.status !== 'active' && (
          <Button size="sm" variant="secondary" onClick={() => onChangeStatus(plan, 'active')}>
            Reactivar
          </Button>
        )}
      </div>
    </Card>
  );
}
