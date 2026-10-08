import { useState } from 'react';
import { Sheet, Button } from '../ui';
import { INPUT_CLASS, TEXTAREA_CLASS } from './inputClasses';
import { formatCurrency } from '../../utils/currency';
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from '../../utils/paymentStatus';
import { isoToLocalDateTimeValue, localDateTimeToTimezoneIso } from '../../utils/timezone';
import type { CurrencyCode, PaymentMethod, PaymentType } from '../../types';
import { t } from '../../i18n/es';

export interface RecordPaymentValues {
  amount: number;
  paymentType: PaymentType;
  method: PaymentMethod;
  paidAt: string;
  reference?: string;
  note?: string;
}

interface RecordPaymentSheetProps {
  open: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  timezone: string;
  /** Saldo pendiente del Job: tope del pago y valor de "Pagar saldo completo". */
  balance: number;
  /** Si el Job todavía no tiene pagos, el tipo por defecto es Anticipo. */
  hasPreviousPayments: boolean;
  /** Devuelve null si salió bien, o un mensaje de error listo para mostrar. */
  onSubmit: (values: RecordPaymentValues) => Promise<string | null>;
}

/** Redondea a centavos para comparar montos sin errores de coma flotante. */
function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Registra un pago sobre un Job. La validación contra sobrepago aquí es
 * solo para dar feedback inmediato: la RPC record_payment es la
 * autoridad real y rechaza igual cualquier monto que exceda el saldo.
 * El padre debe montarlo con una `key` que cambie al abrir, para que
 * cada apertura empiece con el formulario limpio.
 */
export default function RecordPaymentSheet({
  open,
  onClose,
  currency,
  timezone,
  balance,
  hasPreviousPayments,
  onSubmit,
}: RecordPaymentSheetProps) {
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>(hasPreviousPayments ? 'partial' : 'deposit');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidAt, setPaidAt] = useState(() => isoToLocalDateTimeValue(new Date().toISOString(), timezone));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  function payFullBalance() {
    setAmount(String(balance));
    setPaymentType('final');
    setError(null);
  }

  async function handleSubmit() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || toCents(parsed) <= 0) {
      setError(t.payments.amountRequired);
      return;
    }
    if (toCents(parsed) > toCents(balance)) {
      setError(t.payments.amountExceeds);
      return;
    }
    if (!paidAt) {
      setError(t.payments.paidAtRequired);
      return;
    }

    setSaving(true);
    setError(null);
    const message = await onSubmit({
      amount: toCents(parsed) / 100,
      paymentType,
      method,
      paidAt: localDateTimeToTimezoneIso(paidAt, timezone),
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (message) {
      setError(message);
    } else {
      onClose();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={t.payments.recordTitle}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={saving} onClick={handleClose}>
            {t.common.close}
          </Button>
          <Button fullWidth disabled={saving} onClick={handleSubmit}>
            {saving ? t.common.loading : t.payments.saveRecord}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
          <span className="text-slate-500">{t.payments.summaryBalance}</span>
          <span className="font-semibold text-slate-900">{formatCurrency(balance, currency)}</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.payments.amountLabel} ({currency}) <span className="text-red-600">*</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT_CLASS}
          />
          <button
            type="button"
            onClick={payFullBalance}
            className="mt-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:underline"
          >
            {t.payments.payFullBalance}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.payments.typeLabel}</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className={INPUT_CLASS}
            >
              {(Object.keys(PAYMENT_TYPE_LABELS) as PaymentType[]).map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.payments.methodLabel}</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className={INPUT_CLASS}
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.payments.paidAtLabel}</label>
          <input
            type="datetime-local"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.payments.referenceLabel} <span className="text-slate-400 font-normal">({t.payments.optional})</span>
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t.payments.referencePlaceholder}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.payments.noteLabel} <span className="text-slate-400 font-normal">({t.payments.optional})</span>
          </label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={TEXTAREA_CLASS} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  );
}
