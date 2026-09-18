import { Card } from '../ui';
import { formatCurrency } from '../../utils/currency';
import { t } from '../../i18n/es';

interface QuoteTotalsEditorProps {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  onDiscountChange: (value: number) => void;
  onTaxChange: (value: number) => void;
}

/**
 * Spec explícita para Nicaragua: no obligar IVA — el impuesto puede
 * dejarse en 0 (es el valor por defecto, nunca se fuerza a un %).
 */
export default function QuoteTotalsEditor({
  subtotal,
  discount,
  tax,
  total,
  onDiscountChange,
  onTaxChange,
}: QuoteTotalsEditorProps) {
  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{t.quotes.subtotal}</span>
          <span className="font-medium text-slate-900">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm text-slate-500 shrink-0">{t.quotes.discount}</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={discount || ''}
            onChange={(e) => onDiscountChange(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0"
            className="w-28 px-3 min-h-9 rounded-lg border border-slate-300 text-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm text-slate-500 shrink-0">{t.quotes.tax}</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={tax || ''}
            onChange={(e) => onTaxChange(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0"
            className="w-28 px-3 min-h-9 rounded-lg border border-slate-300 text-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="font-semibold text-slate-900">{t.quotes.grandTotal}</span>
          <span className="text-lg font-semibold text-brand-700">{formatCurrency(total)}</span>
        </div>
      </div>
    </Card>
  );
}
