import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState } from '../components/ui';
import OpportunityCard from '../components/dashboard/OpportunityCard';
import FilterChips from '../components/clients/FilterChips';
import PostponeModal from '../components/opportunities/PostponeModal';
import DiscardModal from '../components/opportunities/DiscardModal';
import ContactSheet from '../components/opportunities/ContactSheet';
import NewOpportunitySheet from '../components/opportunities/NewOpportunitySheet';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useOpportunityStore } from '../store/opportunityStore';
import { useClientsById } from '../hooks/useClientsById';
import { useOpportunityActions } from '../hooks/useOpportunityActions';
import { OPPORTUNITY_CATEGORY_LABELS, type OpportunityCategory } from '../types';
import { filterOpportunities, isVisibleOpportunity, type OpportunityFilter } from '../services/opportunityService';
import { formatCurrency } from '../utils/currency';
import { t } from '../i18n/es';

const CATEGORY_OPTIONS: { value: OpportunityFilter; label: string }[] = [
  { value: 'all', label: t.opportunities.filterAll },
  ...(Object.entries(OPPORTUNITY_CATEGORY_LABELS) as [OpportunityCategory, string][]).map(
    ([value, label]) => ({ value, label })
  ),
];

export default function OpportunitiesPage() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const opportunities = useOpportunityStore((s) => s.opportunities);
  const loading = useOpportunityStore((s) => s.loading);
  const error = useOpportunityStore((s) => s.error);
  const loadOpportunities = useOpportunityStore((s) => s.load);
  const createOpportunity = useOpportunityStore((s) => s.create);
  const { clients, clientsById } = useClientsById();
  const actions = useOpportunityActions();

  const [categoryFilter, setCategoryFilter] = useState<OpportunityFilter>('all');
  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false);

  useEffect(() => {
    if (companyId) loadOpportunities(companyId);
  }, [companyId, loadOpportunities]);

  // "active" y "contacted" cuentan como visibles/vigentes: contactar no
  // debe retirar la oportunidad de esta lista, solo descartar o convertir sí.
  const visibleOpportunities = useMemo(
    () =>
      opportunities
        .filter(isVisibleOpportunity)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [opportunities]
  );

  const filtered = useMemo(
    () => filterOpportunities(visibleOpportunities, categoryFilter),
    [visibleOpportunities, categoryFilter]
  );

  const totalPotential = useMemo(
    () => visibleOpportunities.reduce((sum, o) => sum + o.estimatedValue, 0),
    [visibleOpportunities]
  );

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t.opportunities.title}</h1>
        <Button size="sm" icon={<Plus size={16} />} onClick={() => setNewOpportunityOpen(true)}>
          {t.opportunities.newOpportunity}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs sm:text-sm text-slate-500">{t.opportunities.thisMonth}</p>
          <p className="text-xl sm:text-2xl font-semibold text-slate-900 mt-1">
            {visibleOpportunities.length}
          </p>
        </Card>
        <Card className="border-brand-200 bg-brand-50/50">
          <p className="text-xs sm:text-sm text-slate-500">{t.opportunities.potentialIncome}</p>
          <p className="text-xl sm:text-2xl font-semibold text-brand-700 mt-1">
            {formatCurrency(totalPotential)}
          </p>
        </Card>
      </div>

      <FilterChips options={CATEGORY_OPTIONS} active={categoryFilter} onChange={setCategoryFilter} />

      {error ? (
        <ErrorState message={error.message} onRetry={() => companyId && loadOpportunities(companyId)} />
      ) : loading ? (
        <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
      ) : filtered.length === 0 ? (
        <EmptyState title={t.opportunities.empty} />
      ) : (
        <div className="space-y-3">
          {filtered.map((opp) => (
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
            />
          ))}
        </div>
      )}

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

      <NewOpportunitySheet
        open={newOpportunityOpen}
        onClose={() => setNewOpportunityOpen(false)}
        clients={clients}
        onCreate={async (input) => {
          const result = await createOpportunity(input);
          return result !== null;
        }}
      />
    </div>
  );
}
