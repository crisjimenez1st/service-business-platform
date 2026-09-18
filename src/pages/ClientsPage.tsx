import { useEffect, useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import ClientListCard from '../components/clients/ClientListCard';
import FilterChips from '../components/clients/FilterChips';
import NewClientSheet from '../components/clients/NewClientSheet';
import { Button, EmptyState, ErrorState } from '../components/ui';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useOpportunityStore } from '../store/opportunityStore';
import { useClientStore } from '../store/clientStore';
import { useClientsById } from '../hooks/useClientsById';
import { filterClients, searchClientsLocal, type ClientFilter } from '../services/clientService';
import { isVisibleOpportunity } from '../services/opportunityService';
import { t } from '../i18n/es';

const FILTER_OPTIONS: { value: ClientFilter; label: string }[] = [
  { value: 'all', label: t.clients.filterAll },
  { value: 'active', label: t.clients.filterActive },
  { value: 'with_balance', label: t.clients.filterBalance },
  { value: 'with_opportunity', label: t.clients.filterOpportunity },
  { value: 'maintenance_due', label: t.clients.filterMaintenance },
  { value: 'warranty_due', label: t.clients.filterWarranty },
];

export default function ClientsPage() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const { clients, loading, error, refetch } = useClientsById();
  const createClient = useClientStore((s) => s.createClient);
  const opportunities = useOpportunityStore((s) => s.opportunities);
  const loadOpportunities = useOpportunityStore((s) => s.load);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [newClientOpen, setNewClientOpen] = useState(false);

  useEffect(() => {
    if (companyId) loadOpportunities(companyId);
  }, [companyId, loadOpportunities]);

  const clientIdsWithOpportunity = useMemo(
    () => new Set(opportunities.filter(isVisibleOpportunity).map((o) => o.clientId)),
    [opportunities]
  );

  const filtered = useMemo(() => {
    const byFilter = filterClients(clients, filter, opportunities);
    return searchClientsLocal(byFilter, query);
  }, [clients, filter, opportunities, query]);

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t.clients.title}</h1>
        <Button size="sm" icon={<Plus size={16} />} onClick={() => setNewClientOpen(true)}>
          {t.clients.newClient}
        </Button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label={t.clients.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.clients.search}
          className="w-full pl-10 pr-3 min-h-12 rounded-xl border border-slate-300 bg-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
        />
      </div>

      <FilterChips options={FILTER_OPTIONS} active={filter} onChange={setFilter} />

      {error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : loading ? (
        <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
      ) : filtered.length === 0 ? (
        <EmptyState title={t.clients.noResults} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((client) => (
            <ClientListCard
              key={client.id}
              client={client}
              hasOpportunity={clientIdsWithOpportunity.has(client.id)}
            />
          ))}
        </div>
      )}

      <NewClientSheet
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onCreate={async (input) => {
          const result = await createClient(input);
          return result !== null;
        }}
      />
    </div>
  );
}
