import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Search, Wallet } from 'lucide-react';
import { Card, EmptyState, ErrorState } from '../components/ui';
import { getCompanyPlans } from '../services/planService';
import { useClientsById } from '../hooks/useClientsById';
import type { TreatmentPlan } from '../types';
import MetricCard from '../components/dashboard/MetricCard';
import FilterChips from '../components/clients/FilterChips';
import ReceivableCard from '../components/payments/ReceivableCard';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useCollectionsStore } from '../store/collectionsStore';
import type { CurrencyCode, Receivable } from '../types';
import { formatCurrency } from '../utils/currency';
import { t } from '../i18n/es';
import { useCollectionsCopy } from '../hooks/useCollectionsCopy';

type CollectionsFilter = 'all' | 'unpaid' | 'partial' | 'overdue';

/**
 * Centro de Cobros (/collections, solo owner/office): responde
 * "¿cuánto me deben, quién me debe y qué tengo que cobrar?".
 * Todos los montos vienen de las RPCs de la migración 013 -- los
 * totales por moneda nunca se suman entre sí, y el orden "vencidos
 * primero" lo decide el servidor.
 */
export default function CollectionsPage() {
  const navigate = useNavigate();
  const copy = useCollectionsCopy();
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const canView = company?.role === 'owner' || company?.role === 'office';

  const receivables = useCollectionsStore((s) => s.receivables);
  const summary = useCollectionsStore((s) => s.summary);
  const unpricedJobs = useCollectionsStore((s) => s.unpricedJobs);
  const loading = useCollectionsStore((s) => s.loading);
  const error = useCollectionsStore((s) => s.error);
  const load = useCollectionsStore((s) => s.load);

  const { clientsById } = useClientsById();
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [filter, setFilter] = useState<CollectionsFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (companyId && canView) load(companyId);
  }, [companyId, canView, load]);

  useEffect(() => {
    if (!companyId || !canView || company?.businessType === 'technical_services') return;
    let cancelled = false;
    (async () => {
      const r = await getCompanyPlans(companyId);
      if (!cancelled && !r.error) setPlans(r.data.filter((p) => p.status !== 'cancelled' && p.total - p.paidAmount > 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, canView, company?.businessType]);

  // Cuentas con saldo pendiente. Los pagados (saldo 0) y los cancelados
  // no son "por cobrar"; los cancelados con dinero cobrado van aparte.
  const { open, review } = useMemo(() => {
    const openList: Receivable[] = [];
    const reviewList: Receivable[] = [];
    receivables.forEach((r) => {
      if (r.requiresReview) reviewList.push(r);
      else if (r.balance > 0) openList.push(r);
    });
    return { open: openList, review: reviewList };
  }, [receivables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return open.filter((r) => {
      if (filter === 'unpaid' && r.paymentStatus !== 'unpaid') return false;
      if (filter === 'partial' && r.paymentStatus !== 'partial') return false;
      if (filter === 'overdue' && !r.isOverdue) return false;
      if (q && !r.clientName.toLowerCase().includes(q) && !r.serviceType.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [open, filter, search]);

  if (!canView) {
    return <EmptyState icon={<Wallet size={32} />} title={copy.forbidden} />;
  }

  const cardCurrencies: { currency: CurrencyCode; outstanding: number; overdueAmount: number; overdueCount: number; openCount: number }[] =
    summary.length > 0
      ? summary
      : [
          {
            currency: (company?.currency ?? 'NIO') as CurrencyCode,
            outstanding: 0,
            overdueAmount: 0,
            overdueCount: 0,
            openCount: 0,
          },
        ];
  const multiCurrency = cardCurrencies.length > 1;

  const filterOptions: { value: CollectionsFilter; label: string }[] = [
    { value: 'all', label: copy.filterAll },
    { value: 'overdue', label: copy.filterOverdue },
    { value: 'unpaid', label: copy.filterUnpaid },
    { value: 'partial', label: copy.filterPartial },
  ];

  function openJob(jobId: string) {
    navigate(`/jobs/${jobId}?tab=payments`);
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{copy.subtitle}</p>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => companyId && load(companyId)} />
      ) : loading && receivables.length === 0 && summary.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {cardCurrencies.map((c) => (
              <div key={c.currency} className="contents">
                <MetricCard
                  label={multiCurrency ? `${copy.outstanding} · ${c.currency}` : copy.outstanding}
                  value={formatCurrency(c.outstanding, c.currency)}
                  icon={<Wallet size={18} />}
                  emphasis
                />
                <MetricCard
                  label={multiCurrency ? `${copy.overdue} · ${c.currency}` : copy.overdue}
                  value={formatCurrency(c.overdueAmount, c.currency)}
                  icon={<Clock size={18} />}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 -mt-2">
            {cardCurrencies
              .map(
                (c) =>
                  `${c.openCount} ${copy.openJobs}${c.overdueCount > 0 ? ` · ${c.overdueCount} ${copy.overdueJobs}` : ''}${multiCurrency ? ` (${c.currency})` : ''}`
              )
              .join(' | ')}
          </p>

          {unpricedJobs.length > 0 && (
            <Card className="bg-amber-50 border-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-700 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    {copy.unpricedTitle} ({unpricedJobs.length})
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5">{copy.unpricedDescription}</p>
                  <ul className="mt-2 divide-y divide-amber-200">
                    {unpricedJobs.map((job) => (
                      <li key={job.jobId} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-amber-950 truncate">{job.clientName}</p>
                          <p className="text-xs text-amber-800 truncate">{job.serviceType}</p>
                        </div>
                        <button
                          onClick={() => navigate(`/jobs/${job.jobId}`)}
                          className="text-sm font-medium text-amber-900 underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded"
                        >
                          {copy.unpricedAction}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          <section className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={copy.searchPlaceholder}
                className="w-full pl-9 pr-3 min-h-11 rounded-xl border border-slate-300 text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
              />
            </div>
            <FilterChips options={filterOptions} active={filter} onChange={setFilter} />

            {open.length === 0 ? (
              <EmptyState
                icon={<Wallet size={32} />}
                title={copy.empty}
                description={copy.emptyDescription}
              />
            ) : filtered.length === 0 ? (
              <EmptyState title={copy.noResults} />
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => (
                  <ReceivableCard key={r.jobId} receivable={r} onOpen={openJob} />
                ))}
              </div>
            )}
          </section>

          {plans.length > 0 && (
            <section className="space-y-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Planes de tratamiento con saldo</h2>
                <p className="text-xs text-slate-500 mt-0.5">Pacientes que van pagando por abonos.</p>
              </div>
              {plans.map((p) => (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:border-slate-300 transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/clients/${p.clientId}?tab=plans`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/clients/${p.clientId}?tab=plans`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{clientsById[p.clientId]?.name ?? '—'}</p>
                      <p className="text-xs text-slate-500 truncate">{p.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">Falta</p>
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(p.total - p.paidAmount, p.currency)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </section>
          )}

          {review.length > 0 && (
            <section className="space-y-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{copy.reviewTitle}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{copy.reviewDescription}</p>
              </div>
              {review.map((r) => (
                <ReceivableCard key={r.jobId} receivable={r} onOpen={openJob} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
