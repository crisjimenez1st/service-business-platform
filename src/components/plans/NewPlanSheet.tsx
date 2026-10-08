import { useState } from 'react';
import { Sheet, Button } from '../ui';
import { INPUT_CLASS, TEXTAREA_CLASS } from '../payments/inputClasses';
import { PAYMENT_METHOD_LABELS } from '../../utils/paymentStatus';
import type { CurrencyCode, PaymentMethod } from '../../types';

export interface NewPlanValues {
  name: string;
  total: number;
  description?: string;
  initialPayment?: number;
  method: PaymentMethod;
}

interface NewPlanSheetProps {
  open: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  /** Devuelve null si salió bien, o un mensaje de error listo para mostrar. */
  onSubmit: (values: NewPlanValues) => Promise<string | null>;
}

const cents = (v: number) => Math.round(v * 100);

/** Crea un plan de tratamiento: nombre, precio total y, si ya pagó algo, el primer abono. Se monta solo al abrir. */
export default function NewPlanSheet({ open, onClose, currency, onSubmit }: NewPlanSheetProps) {
  const [name, setName] = useState('');
  const [total, setTotal] = useState('');
  const [initial, setInitial] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const totalNum = Number(total);
    const initialNum = initial.trim() === '' ? 0 : Number(initial);
    if (name.trim() === '') return setError('Escribe el nombre del tratamiento.');
    if (!Number.isFinite(totalNum) || cents(totalNum) <= 0) return setError('Escribe el precio total.');
    if (!Number.isFinite(initialNum) || initialNum < 0) return setError('El primer abono no es válido.');
    if (cents(initialNum) > cents(totalNum)) return setError('El primer abono no puede ser mayor al precio total.');

    setSaving(true);
    setError(null);
    const message = await onSubmit({
      name: name.trim(),
      total: cents(totalNum) / 100,
      description: description.trim() || undefined,
      initialPayment: initialNum > 0 ? cents(initialNum) / 100 : undefined,
      method,
    });
    setSaving(false);
    if (message) setError(message);
    else onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={() => !saving && onClose()}
      title="Nuevo plan de tratamiento"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={saving} onClick={onClose}>
            Cerrar
          </Button>
          <Button fullWidth disabled={saving} onClick={handleSubmit}>
            {saving ? 'Guardando…' : 'Crear plan'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="plan-name" className="block text-sm font-medium text-slate-700 mb-1.5">
            Tratamiento <span className="text-red-600">*</span>
          </label>
          <input id="plan-name" className={INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ortodoncia, Implante, Endodoncia..." />
        </div>
        <div>
          <label htmlFor="plan-total" className="block text-sm font-medium text-slate-700 mb-1.5">
            Precio total ({currency}) <span className="text-red-600">*</span>
          </label>
          <input id="plan-total" type="number" inputMode="decimal" min="0" step="0.01" className={INPUT_CLASS} value={total} onChange={(e) => setTotal(e.target.value)} />
        </div>
        <div>
          <label htmlFor="plan-initial" className="block text-sm font-medium text-slate-700 mb-1.5">
            Primer abono ({currency}) <span className="text-slate-400 font-normal">opcional</span>
          </label>
          <input id="plan-initial" type="number" inputMode="decimal" min="0" step="0.01" className={INPUT_CLASS} value={initial} onChange={(e) => setInitial(e.target.value)} />
        </div>
        {initial.trim() !== '' && Number(initial) > 0 && (
          <div>
            <label htmlFor="plan-method" className="block text-sm font-medium text-slate-700 mb-1.5">
              ¿Cómo pagó?
            </label>
            <select id="plan-method" className={INPUT_CLASS} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="plan-desc" className="block text-sm font-medium text-slate-700 mb-1.5">
            Detalle <span className="text-slate-400 font-normal">opcional</span>
          </label>
          <textarea id="plan-desc" rows={3} maxLength={2000} className={TEXTAREA_CLASS} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. 18 meses, controles mensuales" />
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
