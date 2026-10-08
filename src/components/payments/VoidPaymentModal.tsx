import { useState } from 'react';
import { Sheet, Button } from '../ui';
import { TEXTAREA_CLASS } from './inputClasses';
import { formatCurrency } from '../../utils/currency';
import type { CurrencyCode } from '../../types';
import { t } from '../../i18n/es';

interface VoidPaymentModalProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  currency: CurrencyCode;
  /** Devuelve null si salió bien, o un mensaje de error listo para mostrar. */
  onConfirm: (reason: string) => Promise<string | null>;
}

/**
 * Anula un pago vía void_payment. Motivo OBLIGATORIO (validado aquí
 * para feedback inmediato; la RPC es la autoridad). El pago nunca se
 * borra: queda anulado en el historial y el saldo del Job se
 * recalcula en el servidor. Se monta con `key` para limpiar el motivo
 * entre aperturas.
 */
export default function VoidPaymentModal({ open, onClose, amount, currency, onConfirm }: VoidPaymentModalProps) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleConfirm() {
    if (reason.trim() === '') {
      setError(t.payments.voidReasonRequired);
      return;
    }
    setSaving(true);
    setError(null);
    const message = await onConfirm(reason.trim());
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
      title={`${t.payments.voidTitle} · ${formatCurrency(amount, currency)}`}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={saving} onClick={handleClose}>
            {t.payments.keepPayment}
          </Button>
          <Button variant="danger" fullWidth disabled={saving} onClick={handleConfirm}>
            {saving ? t.common.loading : t.payments.confirmVoid}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          {t.payments.voidWarning}
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.payments.voidReasonLabel} <span className="text-red-600">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.payments.voidReasonPlaceholder}
            rows={3}
            className={TEXTAREA_CLASS}
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  );
}
