import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Clock, Briefcase, TrendingUp, FileText } from 'lucide-react';
import MetricCard from '../components/dashboard/MetricCard';
import TodayJobCard from '../components/dashboard/TodayJobCard';
import OpportunityCard from '../components/dashboard/OpportunityCard';
import PostponeModal from '../components/opportunities/PostponeModal';
import DiscardModal from '../components/opportunities/DiscardModal';
import ContactSheet from '../components/opportunities/ContactSheet';
import { EmptyState, ErrorState, Button, Badge } from '../components/ui';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useOpportunityStore } from '../store/opportunityStore';
import { useClientsById } from '../hooks/useClientsById';
import { useOpportunityActions } from '../hooks/useOpportunityActions';
import { getDashboardMetrics, type DashboardMetrics } from '../services/dashboardService';
import { renderMetric } from '../utils/renderMetric';
import { isVisibleOpportunity } from '../services/opportunityService';
import { getAll } from '../services/localDb';
import { TABLES } from '../services/tables';
import type { User } from '../types';
import { formatCurrency } from '../utils/currency';
import { t } from '../i18n/es';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const opportunities = useOpportunityStore((s) => s.opportunities);
  const opportunitiesLoading = useOpportunityStore((s) => s.loading);
  const opportunitiesError = useOpportunityStore((s) => s.error);
  const loadOpportunities = useOpportunityStore((s) => s.load);
  const { clientsById } = useClientsById();
  const actions = useOpportunityActions();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    if (companyId) loadOpportunities(companyId);
  }, [companyId, loadOpportunities]);

  // getDashboardMetrics ahora es async (quotesService.getQuotes
  // consulta Supabase) -- se resuelve en un efecto explícito, no en un
  // useMemo síncrono. Sin loading/error propios aquí porque las
  // métricas individuales ya declaran su disponibilidad (real/mock/
  // unavailable, ver dashboardService.ts); un fallo puntual de quotes
  // se refleja como 'unavailable' en esas 3 métricas, no como un error
  // de página completa.
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    getDashboardMetrics(companyId).then((result) => {
      if (!cancelled) setMetrics(result);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // "active" y "contacted" se muestran igual: contactar a un cliente no
  // debe hacer desaparecer la oportunidad, solo marcarla visualmente.
  const visibleOpportunities = useMemo(
    () =>
      opportunities
        .filter(isVisibleOpportunity)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 3),
    [opportunities]
  );

  const totalPotential = useMemo(
    () => opportunities.filter(isVisibleOpportunity).reduce((sum, o) => sum + o.estimatedValue, 0),
    [opportunities]
  );

  const technicians = useMemo(() => getAll<User>(TABLES.users), []);
  const techNameById = useMemo(() => {
    const map: Record<string, string> = {};
    technicians.forEach((tech) => {
      map[tech.id] = tech.name;
    });
    return map;
  }, [technicians]);

  if (!metrics) {
    return <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>;
  }

  // Calculados una sola vez -- ver utils/renderMetric.ts: cada uno
  // decide "—" (unavailable) o el valor + insignia "Demo" (mock).
  const monthSalesMetric = renderMetric(metrics.monthSales, formatCurrency);
  const pendingCollectionMetric = renderMetric(metrics.pendingCollection, formatCurrency);
  const jobsTodayMetric = renderMetric(metrics.jobsToday);
  const quotesPendingResponseMetric = renderMetric(metrics.quotesPendingResponse);
  const quotesAcceptedThisMonthMetric = renderMetric(metrics.quotesAcceptedThisMonth);
  const quotesPendingValueMetric = renderMetric(metrics.quotesPendingValue, formatCurrency);

  return (
    <div className="space-y-6 pb-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t.dashboard.title}</h1>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label={t.dashboard.monthSales}
          value={monthSalesMetric.display}
          badge={monthSalesMetric.badge}
          icon={<DollarSign size={18} />}
        />
        <MetricCard
          label={t.dashboard.pendingCollection}
          value={pendingCollectionMetric.display}
          badge={pendingCollectionMetric.badge}
          icon={<Clock size={18} />}
        />
        <MetricCard
          label={t.dashboard.jobsToday}
          value={jobsTodayMetric.display}
          badge={jobsTodayMetric.badge}
          icon={<Briefcase size={18} />}
        />
        <MetricCard
          label={t.dashboard.opportunityValue}
          value={formatCurrency(totalPotential)}
          icon={<TrendingUp size={18} />}
          emphasis
        />
      </div>

      {/* Trabajos de hoy — datos demo, Jobs todavía no migrado a Supabase */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              {t.dashboard.todayJobsTitle}
            </h2>
            <Badge tone="neutral">{t.dashboard.mockDataBadge}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')}>
            {t.dashboard.viewAll}
          </Button>
        </div>
        {metrics.todayJobs.length === 0 ? (
          <EmptyState title={t.dashboard.noJobsToday} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.todayJobs.map((job) => (
              <TodayJobCard
                key={job.id}
                job={job}
                client={clientsById[job.clientId]}
                technicianName={job.technicianId ? techNameById[job.technicianId] : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Oportunidades de ingreso — máxima presencia visual */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">
            {t.dashboard.opportunitiesTitle}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/opportunities')}>
            {t.dashboard.viewAll}
          </Button>
        </div>

        {opportunitiesError ? (
          <ErrorState
            message={opportunitiesError.message}
            onRetry={() => companyId && loadOpportunities(companyId)}
          />
        ) : opportunitiesLoading ? (
          <p className="text-center text-sm text-slate-500 py-8">{t.common.loading}</p>
        ) : visibleOpportunities.length === 0 ? (
          <EmptyState title={t.dashboard.noOpportunities} />
        ) : (
          <div className="space-y-3">
            {visibleOpportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                client={clientsById[opp.clientId]}
                onPostpone={actions.openPostpone}
                onDiscard={actions.openDiscard}
                onContact={actions.openContact}
                onCreateQuote={actions.createQuote}
                onSendOffer={actions.sendOffer}
                creatingQuote={actions.creatingQuoteForId === opp.id}
                compact
              />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-600 text-white px-4 py-3">
          <span className="text-sm font-medium">{t.dashboard.totalPotential}</span>
          <span className="text-lg font-semibold">{formatCurrency(totalPotential)}</span>
        </div>
      </section>

      {/* Cotizaciones — sección pequeña, Oportunidades sigue siendo la función principal */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">
            {t.dashboard.quotesSectionTitle}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/quotes')}>
            {t.dashboard.viewAll}
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label={t.dashboard.quotesPendingResponse}
            value={quotesPendingResponseMetric.display}
            badge={quotesPendingResponseMetric.badge}
            icon={<FileText size={18} />}
          />
          <MetricCard
            label={t.dashboard.quotesAcceptedThisMonth}
            value={quotesAcceptedThisMonthMetric.display}
            badge={quotesAcceptedThisMonthMetric.badge}
            icon={<FileText size={18} />}
          />
          <MetricCard
            label={t.dashboard.quotesPendingValue}
            value={quotesPendingValueMetric.display}
            badge={quotesPendingValueMetric.badge}
            icon={<FileText size={18} />}
          />
        </div>
      </section>

      <PostponeModal
        open={actions.postponeTargetId !== null}
        onClose={actions.closePostpone}
        onConfirm={actions.confirmPostpone}
      />
      <DiscardModal
        open={actions.discardTargetId !== null}
        onClose={actions.closeDiscard}
        onConfirm={actions.confirmDiscard}
      />
      <ContactSheet
        open={actions.contactTargetId !== null}
        onClose={actions.closeContact}
        client={actions.contactTargetClient}
        whatsappMessage={actions.contactWhatsAppMessage}
        onChooseChannel={actions.confirmContact}
      />
    </div>
  );
}
