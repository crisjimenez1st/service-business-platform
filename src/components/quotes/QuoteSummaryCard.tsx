import { useNavigate } from 'react-router-dom';
import { Card, Badge } from '../ui';
import type { Quote } from '../../types';
import { getEffectiveStatus } from '../../services/quoteService';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from '../../utils/quoteStatus';
import { formatCurrency } from '../../utils/currency';
import { formatDateShort } from '../../utils/dates';

interface QuoteSummaryCardProps {
  quote: Quote;
}

/**
 * Card compacta para contextos donde la cotización aparece dentro de
 * otra pantalla (tab "Cotizaciones" del perfil de cliente) — a
 * diferencia de QuoteRow (listado principal /quotes, que alterna
 * card/tabla), aquí siempre es card: es una lista corta dentro de un
 * tab, no justifica una tabla completa con encabezados propios.
 */
export default function QuoteSummaryCard({ quote }: QuoteSummaryCardProps) {
  const navigate = useNavigate();
  const effectiveStatus = getEffectiveStatus(quote);

  return (
    <button
      onClick={() => navigate(`/quotes/${quote.id}`)}
      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl"
    >
      <Card className="hover:border-brand-200 active:bg-slate-50 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-brand-600">{quote.quoteNumber}</p>
          <Badge tone={QUOTE_STATUS_TONES[effectiveStatus]}>{QUOTE_STATUS_LABELS[effectiveStatus]}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{formatDateShort(quote.issueDate)}</span>
          <span className="font-semibold text-slate-900">{formatCurrency(quote.total)}</span>
        </div>
      </Card>
    </button>
  );
}
