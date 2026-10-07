import { Badge, Card } from '../ui';
import type { Receivable } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from '../../utils/paymentStatus';
import { formatCalendarDate } from '../../utils/timezone';
import { t } from '../../i18n/es';

interface ReceivableCardProps {
  receivable: Receivable;
  onOpen: (jobId: string) => void;
}

/**
 * Fila del Centro de Cobros. Muestra los montos tal como los devuelve
 * get_company_receivables -- nunca recalcula saldos ni vencimientos en
 * el cliente. Los cancelados con dinero cobrado (requiresReview) se
 * muestran con lo cobrado en vez de un saldo, porque ya no son deuda.
 */
export default function ReceivableCard({ receivable: r, onOpen }: ReceivableCardProps) {
  return (
    <Card
      className="cursor-pointer hover:border-slate-300 transition-colors"
      onClick={() => onOpen(r.jobId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(r.jobId);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{r.clientName}</p>
          <p className="text-xs text-slate-500 truncate">{r.serviceType}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
          {r.isOverdue && <Badge tone="danger">{t.collections.overdueBadge}</Badge>}
          {!r.requiresReview && (
            <Badge tone={PAYMENT_STATUS_TONES[r.paymentStatus]}>{PAYMENT_STATUS_LABELS[r.paymentStatus]}</Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          {r.requiresReview ? (
            <>
              <p className="text-xs text-slate-500">{t.collections.reviewCollected}</p>
              <p className="text-lg font-semibold text-amber-700">{formatCurrency(r.paidAmount, r.currency)}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">{t.collections.balance}</p>
              <p className={['text-lg font-semibold', r.isOverdue ? 'text-red-700' : 'text-slate-900'].join(' ')}>
                {formatCurrency(r.balance, r.currency)}
              </p>
            </>
          )}
        </div>
        <div className="text-right text-xs text-slate-500">
          {!r.requiresReview && (
            <p>
              {t.collections.paid} {formatCurrency(r.paidAmount, r.currency)} / {formatCurrency(r.total, r.currency)}
            </p>
          )}
          <p className={r.isOverdue ? 'text-red-700 font-medium' : ''}>
            {r.dueDate ? `${t.collections.dueDate} ${formatCalendarDate(r.dueDate)}` : t.collections.noDueDate}
          </p>
        </div>
      </div>
    </Card>
  );
}
