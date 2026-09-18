import { useState } from 'react';
import { Sheet, Button } from '../ui';
import { t } from '../../i18n/es';

interface CancelJobModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, category?: string) => Promise<boolean>;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'client_request', label: t.jobsPage.cancelCategoryClientRequest },
  { value: 'no_show', label: t.jobsPage.cancelCategoryNoShow },
  { value: 'rescheduled_elsewhere', label: t.jobsPage.cancelCategoryRescheduled },
  { value: 'other', label: t.jobsPage.cancelCategoryOther },
];

/**
 * Cancela un Job vía cancel_job (migración 011, Bloque 5). Motivo de
 * texto OBLIGATORIO -- validado aquí para dar feedback inmediato, pero
 * la RPC es la autoridad real (rechaza igual si llegara vacío por
 * cualquier otra vía). Categoría opcional, con el set fijo que ya
 * acepta el CHECK de la columna -- no es texto libre.
 */
export default function CancelJobModal({ open, onClose, onConfirm }: CancelJobModalProps) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (saving) return;
    setReason('');
    setCategory('');
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    if (reason.trim() === '') {
      setError(t.jobsPage.cancelReasonRequired);
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await onConfirm(reason.trim(), category || undefined);
    setSaving(false);
    if (ok) {
      setReason('');
      setCategory('');
      onClose();
    } else {
      setError('No pudimos cancelar el trabajo. Intenta de nuevo.');
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={t.jobsPage.cancelJobTitle}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={saving} onClick={handleClose}>
            {t.jobsPage.keepJob}
          </Button>
          <Button variant="danger" fullWidth disabled={saving} onClick={handleConfirm}>
            {saving ? t.common.loading : t.jobsPage.confirmCancel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          {t.jobsPage.cancelJobWarning}
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.jobsPage.cancelReasonLabel} <span className="text-red-600">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.jobsPage.cancelReasonPlaceholder}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.jobsPage.cancelCategoryLabel}</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          >
            <option value="">—</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  );
}
