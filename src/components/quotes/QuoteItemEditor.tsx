import { Trash2 } from 'lucide-react';
import { Card } from '../ui';
import { formatCurrency } from '../../utils/currency';
import { calculateItemSubtotal } from '../../services/quoteService';
import { t } from '../../i18n/es';

export interface EditableQuoteItem {
  /** Id local temporal (no persistido) — solo para key de React y reordenar. */
  localId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface QuoteItemEditorProps {
  item: EditableQuoteItem;
  index: number;
  canRemove: boolean;
  onChange: (localId: string, patch: Partial<EditableQuoteItem>) => void;
  onRemove: (localId: string) => void;
}

/**
 * Card editable por ítem — spec explícita: "en móvil NO usar una tabla
 * horizontal gigante, cada item puede aparecer como card editable".
 * Se usa igual en desktop (mismo componente, la página lo apila en una
 * columna) porque una tabla de inputs no gana claridad frente a esto.
 */
export default function QuoteItemEditor({ item, index, canRemove, onChange, onRemove }: QuoteItemEditorProps) {
  const subtotal = calculateItemSubtotal(item.quantity, item.unitPrice, item.discount);

  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-xs font-medium text-slate-500">Ítem {index + 1}</span>
        {canRemove && (
          <button
            onClick={() => onRemove(item.localId)}
            aria-label={t.quotes.removeItem}
            className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 -mt-1 -mr-1"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t.quotes.description}</label>
          <input
            type="text"
            value={item.description}
            onChange={(e) => onChange(item.localId, { description: e.target.value })}
            placeholder="Ej. Mantenimiento preventivo de sistema CCTV"
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t.quotes.quantity}</label>
            <input
              type="number"
              min={1}
              step={1}
              value={item.quantity}
              onChange={(e) => onChange(item.localId, { quantity: Math.max(1, Number(e.target.value) || 1) })}
              className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t.quotes.unitPrice}</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={item.unitPrice}
              onChange={(e) => onChange(item.localId, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {t.quotes.itemDiscount} <span className="text-slate-500 font-normal">(opcional)</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={item.discount || ''}
            onChange={(e) => onChange(item.localId, { discount: Math.max(0, Number(e.target.value) || 0) })}
            placeholder="0"
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-500">{t.quotes.itemSubtotal}</span>
          <span className="text-sm font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
        </div>
      </div>
    </Card>
  );
}
