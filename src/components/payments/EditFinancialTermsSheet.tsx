import { useState } from 'react';
import { Sheet, Button } from '../ui';
import { INPUT_CLASS } from './inputClasses';
import { formatCurrency } from '../../utils/currency';
import type { CurrencyCode } from '../../types';
import { t } from '../../i18n/es';

interface EditFinancialTermsSheetProps {
  open: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  currentTotal: number | undefined;
  /** Lo ya cobrado: el total nunca puede ser menor. */
  paidAmount: number;
  /** Fecha calendario YYYY-MM-DD. */
  currentDueDate: string | undefined;
  /** Devuelve null si salió bien, o un mensaje de error listo para mostrar. */
  onSubmit: (total: number, dueDate: string | null) => Promise<string | null>;
}

/**
 * Define o corrige el total y el vencimiento de un Job (solo si no
 * está completado ni cancelado) vía set_job_financial_terms. La
 * moneda es informativa: está congelada por Job y no se cambia aquí.
 * Se monta con `key` para precargar valores frescos en cada apertura.
 */
export default function EditFinancialTermsSheet({
  open,
  onClose,
  currency,
  currentTotal,
  paidAmount,
  currentDueDate,
  onSubmit,
}: EditFinancialTermsSheetProps) {
  const [total, setTotal] = useState(currentTotal !== undefined ? String(currentTotal) : '');
  const [dueDate, setDueDate] = useState(currentDueDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit() {
    const parsed = Number(total);
    if (!Number.isFinite(parsed) || Math.round(parsed * 100) <= 0) {
      setError(t.payments.totalRequired);
      return;
    }
    if (Math.round(parsed * 100) < Math.round(paidAmount * 100)) {
      setError(t.payments.totalBelowPaid);
      return;
    }
    setSaving(true);
    setError(null);
    const message = await onSubmit(Math.round(parsed * 100) / 100, dueDate || null);
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
      title={t.payments.termsTitle}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={saving} onClick={handleClose}>
            {t.common.close}
          </Button>
          <Button fullWidth disabled={saving} onClick={handleSubmit}>
            {saving ? t.common.loading : t.payments.saveTerms}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {paidAmount > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
            <span className="text-slate-500">{t.payments.summaryPaid}</span>
            <span className="font-semibold text-slate-900">{formatCurrency(paidAmount, currency)}</span>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.payments.totalLabel} ({currency}) <span className="text-red-600">*</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.payments.dueDateLabel}</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={INPUT_CLASS} />
          {dueDate && (
            <button
              type="button"
              onClick={() => setDueDate('')}
              className="mt-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:underline"
            >
              {t.payments.clearDueDate}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  );
}
