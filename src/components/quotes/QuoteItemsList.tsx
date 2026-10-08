import type { CurrencyCode } from '../../types';
import { Card } from '../ui';
import type { QuoteItem } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { t } from '../../i18n/es';

interface QuoteItemsListProps {
  items: QuoteItem[];
  currency: CurrencyCode;
}

/** Vista de solo lectura de los ítems — usada en detalle admin y en la página pública. */
export default function QuoteItemsList({ items, currency }: QuoteItemsListProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{item.description}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.quantity} × {formatCurrency(item.unitPrice, currency)}
                {item.discount ? ` − ${formatCurrency(item.discount, currency)} ${t.quotes.itemDiscount.toLowerCase()}` : ''}
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-900 shrink-0">
              {formatCurrency(item.subtotal, currency)}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
