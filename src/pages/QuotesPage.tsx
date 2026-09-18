import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import QuoteRow from '../components/quotes/QuoteRow';
import FilterChips from '../components/clients/FilterChips';
import { Button, EmptyState, ErrorState } from '../components/ui';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useQuoteStore } from '../store/quoteStore';
import { useClientsById } from '../hooks/useClientsById';
import { filterQuotes, searchQuotesLocal, type QuoteFilter } from '../services/quoteService';
import { t } from '../i18n/es';

const FILTER_OPTIONS: { value: QuoteFilter; label: string }[] = [
  { value: 'all', label: t.quotes.filterAll },
  { value: 'draft', label: t.quotes.filterDraft },
  { value: 'sent', label: t.quotes.filterSent },
  { value: 'accepted', label: t.quotes.filterAccepted },
  { value: 'rejected', label: t.quotes.filterRejected },
];

export default function QuotesPage() {
  const navigate = useNavigate();
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const quotes = useQuoteStore((s) => s.quotes);
  const loading = useQuoteStore((s) => s.loading);
  const error = useQuoteStore((s) => s.error);
  const loadQuotes = useQuoteStore((s) => s.load);
  const { clientsById } = useClientsById();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<QuoteFilter>('all');

  useEffect(() => {
    if (companyId) loadQuotes(companyId);
  }, [companyId, loadQuotes]);

  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(clientsById).forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [clientsById]);

  const filtered = useMemo(() => {
    const byFilter = filterQuotes(quotes, filter);
    return searchQuotesLocal(byFilter, query, clientNameById);
  }, [quotes, filter, query, clientNameById]);

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t.quotes.title}</h1>
        <Button
          size="sm"
          icon={<Plus size={16} />}
          onClick={() => navigate('/quotes/new')}
          className="shrink-0"
        >
          {t.quotes.newQuote}
        </Button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          aria-label={t.quotes.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.quotes.search}
          className="w-full pl-10 pr-3 min-h-12 rounded-xl border border-slate-300 bg-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
        />
      </div>

      <FilterChips options={FILTER_OPTIONS} active={filter} onChange={setFilter} />

      {error ? (
        <ErrorState message={error.message} onRetry={() => companyId && loadQuotes(companyId)} />
      ) : loading ? (
        <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
      ) : filtered.length === 0 ? (
        <EmptyState title={t.quotes.noResults} />
      ) : (
        <>
          {/* Mobile: cards apiladas */}
          <div className="md:hidden space-y-3">
            {filtered.map((quote) => (
              <QuoteRow key={quote.id} quote={quote} clientName={clientNameById[quote.clientId] ?? '—'} />
            ))}
          </div>

          {/* Desktop: tabla profesional */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {t.quotes.number}
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {t.quotes.client}
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {t.quotes.date}
                  </th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {t.quotes.total}
                  </th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {t.quotes.status}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quote) => (
                  <QuoteRow key={quote.id} quote={quote} clientName={clientNameById[quote.clientId] ?? '—'} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
