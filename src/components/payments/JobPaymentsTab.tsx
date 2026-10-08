import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, MessageCircle } from 'lucide-react';
import { Badge, Button, Card, ErrorState } from '../ui';
import RecordPaymentSheet, { type RecordPaymentValues } from './RecordPaymentSheet';
import VoidPaymentModal from './VoidPaymentModal';
import WhatsAppFollowupSheet from '../followups/WhatsAppFollowupSheet';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { preparePaymentReceipt, buildReceiptLink } from '../../services/receiptService';
import { receiptMessage } from '../../i18n/businessTerms';
import { buildWhatsAppLink, toWhatsAppNumber } from '../../utils/whatsapp';
import EditFinancialTermsSheet from './EditFinancialTermsSheet';
import * as paymentService from '../../services/paymentService';
import type { CurrencyCode, Job, Payment } from '../../types';
import { formatCurrency } from '../../utils/currency';
import {
  getJobFinancials,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  PAYMENT_TYPE_LABELS,
} from '../../utils/paymentStatus';
import { formatCalendarDate, formatLongDateInTimezone, formatTimeInTimezone } from '../../utils/timezone';
import { t } from '../../i18n/es';

interface JobPaymentsTabProps {
  job: Job;
  timezone: string;
  /** Paciente del trabajo, para enviarle el recibo por WhatsApp. */
  client?: { name: string; phone: string; whatsapp?: string };
  /** Se llama con el Job actualizado (paid_amount recalculado por el servidor) tras registrar/anular/editar. */
  onJobChange: (job: Job) => void;
}

/**
 * Pestaña "Cobros" de /jobs/:id (solo owner/office -- la página
 * completa ya lo es). Muestra el estado financiero derivado, las
 * condiciones (total + vencimiento) y el historial de pagos con
 * registro y anulación. Nunca calcula ni modifica paid_amount por su
 * cuenta: toda mutación pasa por paymentService y el Job que vuelve
 * del servidor es el que se muestra.
 */
export default function JobPaymentsTab({ job, timezone, client, onJobChange }: JobPaymentsTabProps) {
  const { company } = useCurrentCompany();
  const currency: CurrencyCode = job.currency;
  const financials = useMemo(() => getJobFinancials(job, timezone), [job, timezone]);

  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordKey, setRecordKey] = useState(0);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsKey, setTermsKey] = useState(0);
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [receiptFor, setReceiptFor] = useState<{ payment: Payment; link: string } | null>(null);
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  async function startReceipt(payment: Payment) {
    setReceiptBusy(payment.id);
    setReceiptError(null);
    const result = await preparePaymentReceipt(payment.id);
    setReceiptBusy(null);
    if (result.error) {
      setReceiptError(result.error.message);
      return;
    }
    setReceiptFor({ payment, link: buildReceiptLink(result.data) });
  }

  const loadPayments = useCallback(async () => {
    const result = await paymentService.getJobPayments(job.id);
    if (result.error) {
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    setPayments(result.data);
  }, [job.id]);

  // Carga inicial (y al cambiar de Job). Inline, con bandera de
  // cancelación, para no actualizar estado de un Job que ya no se muestra.
  useEffect(() => {
    let cancelled = false;
    paymentService.getJobPayments(job.id).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setLoadFailed(true);
        return;
      }
      setLoadFailed(false);
      setPayments(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  const operationLocked = job.status === 'completed' || job.status === 'cancelled';
  const canRecord = job.status !== 'cancelled' && financials.hasTotal && financials.balance > 0;
  const hasActivePayments = (payments ?? []).some((p) => !p.voidedAt);

  async function handleRecord(values: RecordPaymentValues): Promise<string | null> {
    const result = await paymentService.recordPayment({ jobId: job.id, ...values });
    if (result.error) return result.error.message;
    onJobChange(result.data);
    await loadPayments();
    return null;
  }

  async function handleVoid(reason: string): Promise<string | null> {
    if (!voidTarget) return t.payments.voidError;
    const result = await paymentService.voidPayment(voidTarget.id, reason);
    if (result.error) return result.error.message;
    onJobChange(result.data);
    await loadPayments();
    return null;
  }

  async function handleTerms(total: number, dueDate: string | null): Promise<string | null> {
    const result = await paymentService.setJobFinancialTerms(job.id, total, dueDate);
    if (result.error) return result.error.message;
    onJobChange(result.data);
    return null;
  }

  return (
    <div className="space-y-3">
      {financials.requiresReview && (
        <Card className="bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">{t.payments.cancelledWithPayments}</p>
        </Card>
      )}

      <Card>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap gap-2">
            {financials.hasTotal && (
              <Badge tone={PAYMENT_STATUS_TONES[financials.paymentStatus]}>
                {PAYMENT_STATUS_LABELS[financials.paymentStatus]}
              </Badge>
            )}
            {financials.isOverdue && <Badge tone="danger">{t.payments.overdueBadge}</Badge>}
          </div>
          {!operationLocked && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil size={14} />}
              onClick={() => {
                setTermsKey((k) => k + 1);
                setTermsOpen(true);
              }}
            >
              {financials.hasTotal ? t.payments.editTerms : t.payments.setTotal}
            </Button>
          )}
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">{t.payments.summaryTotal}</span>
            <span className="font-medium text-slate-900">
              {financials.hasTotal ? formatCurrency(financials.total, currency) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t.payments.summaryPaid}</span>
            <span className="font-medium text-slate-900">{formatCurrency(financials.paidAmount, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1.5">
            <span className="text-slate-700 font-medium">{t.payments.summaryBalance}</span>
            <span className="font-semibold text-slate-900">
              {financials.hasTotal ? formatCurrency(financials.balance, currency) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t.payments.dueDate}</span>
            <span className={financials.isOverdue ? 'font-medium text-red-700' : 'text-slate-700'}>
              {job.dueDate ? formatCalendarDate(job.dueDate) : t.payments.noDueDate}
            </span>
          </div>
        </div>

        {!financials.hasTotal && !operationLocked && (
          <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{t.payments.noTotalNotice}</p>
        )}
        {operationLocked && (
          <p className="mt-3 text-xs text-slate-500">
            {job.status === 'cancelled' ? t.payments.cancelledNoCollect : t.payments.termsLockedNotice}
          </p>
        )}

        {canRecord && (
          <Button
            fullWidth
            className="mt-4"
            icon={<Plus size={16} />}
            onClick={() => {
              setRecordKey((k) => k + 1);
              setRecordOpen(true);
            }}
          >
            {t.payments.registerPayment}
          </Button>
        )}
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">{t.payments.history}</h3>
        {loadFailed ? (
          <ErrorState message={t.payments.loadError} onRetry={loadPayments} />
        ) : payments === null ? (
          <p className="text-center text-sm text-slate-500 py-6">{t.common.loading}</p>
        ) : payments.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 text-center py-4">{t.payments.noPayments}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => {
              const voided = payment.voidedAt !== undefined;
              return (
                <Card key={payment.id} className={voided ? 'bg-slate-50' : ''}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={[
                          'text-base font-semibold',
                          voided ? 'text-slate-400 line-through' : 'text-slate-900',
                        ].join(' ')}
                      >
                        {formatCurrency(payment.amount, currency)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {PAYMENT_TYPE_LABELS[payment.paymentType]} · {PAYMENT_METHOD_LABELS[payment.method]}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatLongDateInTimezone(payment.paidAt, timezone)} · {formatTimeInTimezone(payment.paidAt, timezone)}
                      </p>
                      {payment.reference && <p className="text-xs text-slate-600 mt-1">Ref: {payment.reference}</p>}
                      {payment.note && <p className="text-xs text-slate-600 mt-0.5">{payment.note}</p>}
                    </div>
                    {voided ? (
                      <Badge tone="neutral">{t.payments.voidedBadge}</Badge>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        {client && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<MessageCircle size={14} />}
                            disabled={receiptBusy === payment.id}
                            onClick={() => startReceipt(payment)}
                          >
                            Enviar recibo
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setVoidTarget(payment)}>
                          {t.payments.voidPayment}
                        </Button>
                      </div>
                    )}
                  </div>
                  {voided && payment.voidReason && (
                    <p className="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">
                      {t.payments.voidedReasonLabel}: {payment.voidReason}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {receiptError && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {receiptError}
        </p>
      )}

      {receiptFor && client && (
        <WhatsAppFollowupSheet
          key={receiptFor.payment.id}
          open
          clientName={client.name}
          initialMessage={receiptMessage(
            client.name,
            company?.name ?? '',
            formatCurrency(receiptFor.payment.amount, currency),
            receiptFor.link
          )}
          onClose={() => setReceiptFor(null)}
          onSend={(message) => {
            const number = toWhatsAppNumber(client.whatsapp || client.phone, timezone);
            window.open(buildWhatsAppLink(number, message), '_blank', 'noopener,noreferrer');
            setReceiptFor(null);
          }}
        />
      )}

      <RecordPaymentSheet
        key={`record-${recordKey}`}
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        currency={currency}
        timezone={timezone}
        balance={financials.balance}
        hasPreviousPayments={hasActivePayments}
        onSubmit={handleRecord}
      />

      <EditFinancialTermsSheet
        key={`terms-${termsKey}`}
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        currency={currency}
        currentTotal={job.total}
        paidAmount={financials.paidAmount}
        currentDueDate={job.dueDate}
        onSubmit={handleTerms}
      />

      <VoidPaymentModal
        key={`void-${voidTarget?.id ?? 'none'}`}
        open={voidTarget !== null}
        onClose={() => setVoidTarget(null)}
        amount={voidTarget?.amount ?? 0}
        currency={currency}
        onConfirm={handleVoid}
      />
    </div>
  );
}
