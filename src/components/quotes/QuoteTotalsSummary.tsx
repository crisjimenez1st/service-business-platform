import { Card } from '../ui';
import { formatCurrency } from '../../utils/currency';
import { t } from '../../i18n/es';

interface QuoteTotalsSummaryProps {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export default function QuoteTotalsSummary({ subtotal, discount, tax, total }: QuoteTotalsSummaryProps) {
  return (
    <Card>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">{t.quotes.subtotal}</span>
          <span className="font-medium text-slate-900">{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{t.quotes.discount}</span>
            <span className="font-medium text-slate-900">− {formatCurrency(discount)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{t.quotes.tax}</span>
            <span className="font-medium text-slate-900">{formatCurrency(tax)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="font-semibold text-slate-900">{t.quotes.grandTotal}</span>
          <span className="text-lg font-semibold text-brand-700">{formatCurrency(total)}</span>
        </div>
      </div>
    </Card>
  );
}
