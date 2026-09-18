import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MessageCircle, MapPin, Pencil } from 'lucide-react';
import { Card, EmptyState, ErrorState } from '../components/ui';
import Tabs from '../components/clients/Tabs';
import EquipmentCard from '../components/clients/EquipmentCard';
import JobHistoryCard from '../components/clients/JobHistoryCard';
import EditClientSheet from '../components/clients/EditClientSheet';
import QuoteSummaryCard from '../components/quotes/QuoteSummaryCard';
import OpportunityCard from '../components/dashboard/OpportunityCard';
import PostponeModal from '../components/opportunities/PostponeModal';
import DiscardModal from '../components/opportunities/DiscardModal';
import ContactSheet from '../components/opportunities/ContactSheet';
import { getClientEquipment, getClientJobs } from '../services/clientService';
import { isVisibleOpportunity } from '../services/opportunityService';
import { useOpportunityStore } from '../store/opportunityStore';
import { useSingleClientStore, useClientStore } from '../store/clientStore';
import { useClientQuotesStore } from '../store/quoteStore';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useOpportunityActions } from '../hooks/useOpportunityActions';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { buildWhatsAppLink } from '../utils/whatsapp';
import { t } from '../i18n/es';

const TABS = [
  { key: 'summary', label: t.clientProfile.tabsSummary },
  { key: 'jobs', label: t.clientProfile.tabsJobs },
  { key: 'quotes', label: t.quotes.title },
  { key: 'equipment', label: t.clientProfile.tabsEquipment },
  { key: 'payments', label: t.clientProfile.tabsPayments },
  { key: 'warranties', label: t.clientProfile.tabsWarranties },
  { key: 'photos', label: t.clientProfile.tabsPhotos },
];

/**
 * `client` es CRUD real de Supabase, cargado vía useSingleClientStore
 * (store/clientStore.ts). `clientQuotes` también es real -- cargado vía
 * useClientQuotesStore (store/quoteStore.ts), mismo criterio: el
 * setState de loading/error vive dentro de la acción de Zustand, no en
 * el cuerpo de un useEffect de este componente. `equipment`, `jobs` y
 * las oportunidades del cliente siguen sobre localDb/mock -- esas
 * entidades no se migran en este bloque.
 */
export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [editOpen, setEditOpen] = useState(false);

  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const opportunities = useOpportunityStore((s) => s.opportunities);
  const loadOpportunities = useOpportunityStore((s) => s.load);
  const actions = useOpportunityActions();

  const client = useSingleClientStore((s) => s.client);
  const clientLoadingState = useSingleClientStore((s) => s.loading);
  const clientError = useSingleClientStore((s) => s.error);
  const loadClient = useSingleClientStore((s) => s.load);
  const setSingleClient = useSingleClientStore((s) => s.setClient);
  const updateClient = useClientStore((s) => s.updateClient);

  const clientQuotes = useClientQuotesStore((s) => s.quotes);
  const quotesLoading = useClientQuotesStore((s) => s.loading);
  const quotesError = useClientQuotesStore((s) => s.error);
  const loadClientQuotes = useClientQuotesStore((s) => s.load);

  useEffect(() => {
    if (companyId) loadOpportunities(companyId);
  }, [companyId, loadOpportunities]);

  useEffect(() => {
    if (id && companyId) loadClient(id, companyId);
  }, [id, companyId, loadClient]);

  useEffect(() => {
    if (id && companyId) loadClientQuotes(companyId, id);
  }, [id, companyId, loadClientQuotes]);

  const clientLoading = !id || !companyId || clientLoadingState;

  const equipment = useMemo(
    () => (id && companyId ? getClientEquipment(id, companyId) : []),
    [id, companyId]
  );
  const jobs = useMemo(
    () => (id && companyId ? getClientJobs(id, companyId) : []),
    [id, companyId]
  );

  // "active" y "contacted" ambas cuentan como vigentes aquí — contactar
  // no debe hacer desaparecer la próxima oportunidad del perfil.
  const clientOpportunities = useMemo(
    () =>
      opportunities
        .filter((o) => o.clientId === id && isVisibleOpportunity(o))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [opportunities, id]
  );
  const nextOpportunity = clientOpportunities[0];

  if (clientLoading) {
    return <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>;
  }

  if (clientError) {
    return (
      <ErrorState
        message={clientError.message}
        onRetry={() => id && companyId && loadClient(id, companyId)}
      />
    );
  }

  if (!client) {
    return (
      <div className="pb-4">
        <EmptyState title="Cliente no encontrado" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <button
        onClick={() => navigate('/clients')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg -ml-1 px-1"
      >
        <ArrowLeft size={16} />
        {t.common.back}
      </button>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{client.name}</h1>
            <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
              <MapPin size={14} className="shrink-0" />
              <span className="truncate">{client.address}</span>
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            aria-label={t.clientProfile.editClient}
            className="shrink-0 min-w-9 min-h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Pencil size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`tel:${client.phone.replace(/\s/g, '')}`}
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 text-sm rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Phone size={16} />
            {t.dashboard.call}
          </a>
          <a
            href={buildWhatsAppLink(client.whatsapp, `Hola ${client.name} 👋`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 text-sm rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <MessageCircle size={16} />
            {t.dashboard.whatsapp}
          </a>
        </div>
      </Card>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <p className="text-xs text-slate-500">{t.clientProfile.totalBilled}</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">
                {formatCurrency(client.totalBilled ?? 0)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">{t.clientProfile.pendingBalance}</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">
                {formatCurrency(client.pendingBalance ?? 0)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">{t.clientProfile.lastService}</p>
              <p className="text-sm font-medium text-slate-900 mt-1">
                {client.lastServiceDate ? formatDate(client.lastServiceDate) : '—'}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">{t.clientProfile.nextMaintenance}</p>
              <p className="text-sm font-medium text-slate-900 mt-1">
                {client.nextMaintenanceDate ? formatDate(client.nextMaintenanceDate) : '—'}
              </p>
            </Card>
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              {t.clientProfile.nextOpportunity}
            </h2>
            {nextOpportunity ? (
              <OpportunityCard
                opportunity={nextOpportunity}
                client={client}
                onPostpone={actions.openPostpone}
                onDiscard={actions.openDiscard}
                onContact={actions.openContact}
                onCreateQuote={actions.createQuote}
                onSendOffer={actions.sendOffer}
                creatingQuote={actions.creatingQuoteForId === nextOpportunity.id}
              />
            ) : (
              <EmptyState title={t.clientProfile.noOpportunity} />
            )}
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <EmptyState title={t.clientProfile.noJobs} />
          ) : (
            jobs.map((job) => <JobHistoryCard key={job.id} job={job} />)
          )}
        </div>
      )}

      {activeTab === 'quotes' && (
        <div className="space-y-3">
          {quotesError ? (
            <ErrorState message={quotesError.message} onRetry={() => id && companyId && loadClientQuotes(companyId, id)} />
          ) : quotesLoading ? (
            <p className="text-center text-sm text-slate-500 py-8">{t.common.loading}</p>
          ) : clientQuotes.length === 0 ? (
            <EmptyState title={t.quotes.noResults} />
          ) : (
            clientQuotes.map((quote) => <QuoteSummaryCard key={quote.id} quote={quote} />)
          )}
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="grid sm:grid-cols-2 gap-3">
          {equipment.length === 0 ? (
            <EmptyState title={t.clientProfile.noEquipment} />
          ) : (
            equipment.map((eq) => <EquipmentCard key={eq.id} equipment={eq} />)
          )}
        </div>
      )}

      {activeTab === 'payments' && <EmptyState title={t.clientProfile.noPayments} />}
      {activeTab === 'warranties' && <EmptyState title={t.clientProfile.noPayments} />}
      {activeTab === 'photos' && <EmptyState title={t.clientProfile.noPhotos} />}

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

      <EditClientSheet
        key={client.id}
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
        onSave={async (patch) => {
          const result = await updateClient(client.id, patch);
          if (result) setSingleClient(result);
          return result !== null;
        }}
      />
    </div>
  );
}
