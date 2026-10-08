import { useState } from 'react';
import { Sheet, Button } from '../ui';
import { INPUT_CLASS, TEXTAREA_CLASS } from '../payments/inputClasses';
import { formatCurrency } from '../../utils/currency';
import { PAYMENT_METHOD_LABELS } from '../../utils/paymentStatus';
import { isoToLocalDateTimeValue, localDateTimeToTimezoneIso } from '../../utils/timezone';
import type { CurrencyCode, PaymentMethod } from '../../types';

interface PlanPaymentSheetProps {
  open: boolean;
  onClose: () => void;
  planName: string;
  currency: CurrencyCode;
  timezone: string;
  balance: number;
  /** Devuelve null si salió bien, o un mensaje de error listo para mostrar. */
  onSubmit: (v: { amount: number; method: PaymentMethod; paidAt: string; note?: string }) => Promise<string | null>;
}

const cents = (v: number) => Math.round(v * 100);

/** Registra un abono de un plan de tratamiento. Se monta solo al abrir. */
export default function PlanPaymentSheet({ open, onClose, planName, currency, timezone, balance, onSubmit }: PlanPaymentSheetProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidAt, setPaidAt] = useState(() => isoToLocalDateTimeValue(new Date().toISOString(), timezone));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || cents(n) <= 0) return setError('Escribe el monto del abono.');
    if (cents(n) > cents(balance)) return setError('El abono no puede ser mayor al saldo pendiente.');
    if (!paidAt) return setError('Indica la fecha del abono.');
    setSaving(true);
    setError(null);
    const message = await onSubmit({
      amount: cents(n) / 100,
      method,
      paidAt: localDateTimeToTimezoneIso(paidAt, timezone),
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (message) setError(message);
    else onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={() => !saving && onClose()}
      title="Registrar abono"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={saving} onClick={onClose}>
            Cerrar
          </Button>
          <Button fullWidth disabled={saving} onClick={handleSubmit}>
            {saving ? 'Guardando…' : 'Registrar abono'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
          <p className="font-medium text-slate-900">{planName}</p>
          <p className="text-slate-500 mt-0.5">
            Saldo pendiente: <span className="font-semibold text-slate-900">{formatCurrency(balance, currency)}</span>
          </p>
        </div>
        <div>
          <label htmlFor="pp-amount" className="block text-sm font-medium text-slate-700 mb-1.5">
            Monto ({currency}) <span className="text-red-600">*</span>
          </label>
          <input id="pp-amount" type="number" inputMode="decimal" min="0" step="0.01" className={INPUT_CLASS} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button type="button" className="mt-2 text-sm font-medium text-brand-700 min-h-9" onClick={() => setAmount(String(balance))}>
            Pagar el saldo completo
          </button>
        </div>
        <div>
          <label htmlFor="pp-method" className="block text-sm font-medium text-slate-700 mb-1.5">
            ¿Cómo pagó?
          </label>
          <select id="pp-method" className={INPUT_CLASS} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pp-date" className="block text-sm font-medium text-slate-700 mb-1.5">
            Fecha y hora
          </label>
          <input id="pp-date" type="datetime-local" className={INPUT_CLASS} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pp-note" className="block text-sm font-medium text-slate-700 mb-1.5">
            Nota <span className="text-slate-400 font-normal">opcional</span>
          </label>
          <textarea id="pp-note" rows={2} maxLength={500} className={TEXTAREA_CLASS} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
