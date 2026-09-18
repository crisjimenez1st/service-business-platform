import { useNavigate } from 'react-router-dom';
import { Clock3 } from 'lucide-react';
import { Card, Badge } from '../ui';
import type { Quote } from '../../types';
import { getEffectiveStatus } from '../../services/quoteService';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from '../../utils/quoteStatus';
import { formatCurrency } from '../../utils/currency';
import { formatDateShort, formatRelativeTime } from '../../utils/dates';
import { t } from '../../i18n/es';

interface QuoteRowProps {
  quote: Quote;
  clientName: string;
}

/**
 * Un solo componente para ambos layouts, como pide la spec ("no tabla
 * horizontal gigante en móvil, cada item como card"):
 * - Card completa, visible solo en móvil (`md:hidden`).
 * - Fila de tabla, visible solo en desktop (`hidden md:table-row`),
 *   pensada para vivir dentro de un <table> real en QuotesPage.
 * Nunca se muestran ambas a la vez, así que no hay contenido duplicado
 * en el DOM más allá de lo que Tailwind oculta por CSS.
 */
export default function QuoteRow({ quote, clientName }: QuoteRowProps) {
  const navigate = useNavigate();
  const effectiveStatus = getEffectiveStatus(quote);
  const viewedNote =
    quote.viewedAt && (effectiveStatus === 'viewed' || effectiveStatus === 'accepted' || effectiveStatus === 'rejected')
      ? `${t.quotes.viewedRelative} ${formatRelativeTime(quote.viewedAt)}`
      : null;

  return (
    <>
      {/* Mobile: card */}
      <button
        onClick={() => navigate(`/quotes/${quote.id}`)}
        className="md:hidden w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl"
      >
        <Card className="hover:border-brand-200 active:bg-slate-50 transition-colors">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-600">{quote.quoteNumber}</p>
              <h3 className="font-semibold text-slate-900 truncate">{clientName}</h3>
            </div>
            <Badge tone={QUOTE_STATUS_TONES[effectiveStatus]}>
              {QUOTE_STATUS_LABELS[effectiveStatus]}
            </Badge>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-sm">
            <span className="text-slate-500">{formatDateShort(quote.issueDate)}</span>
            <span className="font-semibold text-slate-900">{formatCurrency(quote.total)}</span>
          </div>
          {viewedNote && (
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
              <Clock3 size={12} />
              <span>{viewedNote}</span>
            </div>
          )}
        </Card>
      </button>

      {/* Desktop: fila de tabla */}
      <tr
        onClick={() => navigate(`/quotes/${quote.id}`)}
        className="hidden md:table-row cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0"
      >
        <td className="py-3 px-4 text-sm font-medium text-brand-700">{quote.quoteNumber}</td>
        <td className="py-3 px-4 text-sm text-slate-900">{clientName}</td>
        <td className="py-3 px-4 text-sm text-slate-500">{formatDateShort(quote.issueDate)}</td>
        <td className="py-3 px-4 text-sm font-semibold text-slate-900 text-right">
          {formatCurrency(quote.total)}
        </td>
        <td className="py-3 px-4 text-right">
          <Badge tone={QUOTE_STATUS_TONES[effectiveStatus]}>
            {QUOTE_STATUS_LABELS[effectiveStatus]}
          </Badge>
        </td>
      </tr>
    </>
  );
}
