import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { EmptyState, ErrorState } from '../components/ui';
import FilterChips from '../components/clients/FilterChips';
import FollowupCard from '../components/followups/FollowupCard';
import TomorrowCard from '../components/followups/TomorrowCard';
import WhatsAppFollowupSheet from '../components/followups/WhatsAppFollowupSheet';
import PostponeModal from '../components/opportunities/PostponeModal';
import DiscardModal from '../components/opportunities/DiscardModal';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useFollowupStore } from '../store/followupStore';
import { useTomorrowStore } from '../store/tomorrowStore';
import { useClientsById } from '../hooks/useClientsById';
import { useTerms } from '../hooks/useTerms';
import { followupMessage, inactiveMessage, appointmentConfirmMessage } from '../i18n/businessTerms';
import { buildWhatsAppLink, toWhatsAppNumber } from '../utils/whatsapp';
import { addDaysToDateKey } from '../utils/followupDates';
import { getTodayKeyInTimezone, formatTimeInTimezone } from '../utils/timezone';
import { t } from '../i18n/es';
import type { FollowupDue, Job } from '../types';

type View = 'today' | 'tomorrow' | 'inactive';

/** "Hace 8 meses" / "Hace 45 días", a partir de los días desde la última visita. */
function sinceLabel(days: number): string {
  const months = Math.floor(days / 30);
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return years === 1 ? 'Hace 1 año' : `Hace ${years} años`;
  }
  if (months >= 1) return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
  return `Hace ${days} días`;
}

/**
 * "A quién avisar hoy": la pantalla diaria del recordatorio, con dos
 * listas -- los avisos que tocan hoy y quienes dejaron de venir. Un
 * toque abre WhatsApp con el mensaje listo (v1: sin API automática);
 * marcar "enviado" es solo local -- el estado del servidor cambia
 * únicamente con el resultado (Agendó / Más tarde / No le interesa).
 */
export default function FollowupsPage() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';
  const terms = useTerms();
  const navigate = useNavigate();
  const { clientsById } = useClientsById();

  const items = useFollowupStore((s) => s.items);
  const inactive = useFollowupStore((s) => s.inactive);
  const sentIds = useFollowupStore((s) => s.sentIds);
  const loading = useFollowupStore((s) => s.loading);
  const error = useFollowupStore((s) => s.error);
  const inactiveLoading = useFollowupStore((s) => s.inactiveLoading);
  const inactiveError = useFollowupStore((s) => s.inactiveError);
  const load = useFollowupStore((s) => s.load);
  const loadInactive = useFollowupStore((s) => s.loadInactive);
  const markSent = useFollowupStore((s) => s.markSent);
  const booked = useFollowupStore((s) => s.booked);
  const postpone = useFollowupStore((s) => s.postpone);
  const discard = useFollowupStore((s) => s.discard);
  const resolveInactive = useFollowupStore((s) => s.resolveInactive);

  const tomorrowJobs = useTomorrowStore((s) => s.jobs);
  const tomorrowSent = useTomorrowStore((s) => s.sentIds);
  const tomorrowConfirmed = useTomorrowStore((s) => s.confirmedIds);
  const tomorrowLoading = useTomorrowStore((s) => s.loading);
  const tomorrowError = useTomorrowStore((s) => s.error);
  const loadTomorrow = useTomorrowStore((s) => s.load);
  const markTomorrowSent = useTomorrowStore((s) => s.markSent);
  const markTomorrowConfirmed = useTomorrowStore((s) => s.markConfirmed);
  const [tomorrowFor, setTomorrowFor] = useState<Job | null>(null);

  const [view, setView] = useState<View>('today');
  const [whatsappFor, setWhatsappFor] = useState<FollowupDue | null>(null);
  const [postponeFor, setPostponeFor] = useState<FollowupDue | null>(null);
  const [discardFor, setDiscardFor] = useState<FollowupDue | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) {
      load(companyId);
      loadInactive(companyId);
      loadTomorrow(companyId, timezone);
    }
  }, [companyId, timezone, load, loadInactive, loadTomorrow]);

  // Los inactivos se muestran con la misma tarjeta: opportunityId = id del cliente.
  const inactiveItems = useMemo<FollowupDue[]>(
    () =>
      inactive.map((c) => ({
        opportunityId: c.clientId,
        clientId: c.clientId,
        clientName: c.clientName,
        clientPhone: c.clientPhone,
        clientWhatsapp: c.clientWhatsapp,
        title: 'Paciente inactivo',
        reason: '',
        status: 'active',
        dueDate: '',
        daysOverdue: c.daysSinceVisit,
        lastVisitAt: c.lastVisitAt,
      })),
    [inactive]
  );

  const isInactiveView = view === 'inactive';
  const list = isInactiveView ? inactiveItems : items;
  const listLoading = isInactiveView ? inactiveLoading : loading;
  const listError = isInactiveView ? inactiveError : error;

  function reload() {
    if (!companyId) return;
    if (isInactiveView) loadInactive(companyId);
    else load(companyId);
  }

  function handleSend(item: FollowupDue, message: string) {
    const number = toWhatsAppNumber(item.clientWhatsapp || item.clientPhone, timezone);
    window.open(buildWhatsAppLink(number, message), '_blank', 'noopener,noreferrer');
    markSent(item.opportunityId);
    setWhatsappFor(null);
  }

  async function run(item: FollowupDue, action: () => Promise<boolean>) {
    setBusyId(item.opportunityId);
    await action();
    setBusyId(null);
  }

  const initialMessage = (item: FollowupDue) =>
    isInactiveView
      ? inactiveMessage(company?.businessType, item.clientName, company?.name ?? '')
      : followupMessage(company?.businessType, item.clientName, company?.name ?? '');

  const filterOptions = [
    { value: 'today' as View, label: `Hoy${items.length > 0 ? ` (${items.length})` : ''}` },
    { value: 'tomorrow' as View, label: `Citas de mañana${tomorrowJobs.length > 0 ? ` (${tomorrowJobs.length})` : ''}` },
    { value: 'inactive' as View, label: `Hace tiempo que no vienen${inactive.length > 0 ? ` (${inactive.length})` : ''}` },
  ];

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{terms.followupsToday}</h1>
        {view !== 'tomorrow' && !listLoading && !listError && list.length > 0 && (
          <p className="text-sm text-slate-500 mt-0.5">
            {list.length === 1 ? '1 persona para avisar' : `${list.length} personas para avisar`}
          </p>
        )}
      </div>

      <FilterChips options={filterOptions} active={view} onChange={setView} />

      {view === 'tomorrow' ? (
        tomorrowError ? (
          <ErrorState message={tomorrowError.message} onRetry={() => companyId && loadTomorrow(companyId, timezone)} />
        ) : tomorrowLoading && tomorrowJobs.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
        ) : tomorrowJobs.length === 0 ? (
          <EmptyState
            icon={<BellRing size={36} />}
            title="No hay citas para mañana"
            description="Cuando agendes citas para mañana, aparecerán aquí para confirmarlas."
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {tomorrowJobs.map((job) => {
              const client = clientsById[job.clientId];
              return (
                <TomorrowCard
                  key={job.id}
                  clientName={client?.name ?? '—'}
                  phone={client?.whatsapp || client?.phone || ''}
                  timeText={job.scheduledStartAt ? formatTimeInTimezone(job.scheduledStartAt, timezone) : ''}
                  serviceType={job.serviceType}
                  sent={tomorrowSent.includes(job.id)}
                  confirmed={tomorrowConfirmed.includes(job.id)}
                  onWhatsApp={() => client && setTomorrowFor(job)}
                  onConfirmed={() => markTomorrowConfirmed(job.id)}
                  onReschedule={() => navigate(`/jobs/${job.id}`)}
                />
              );
            })}
          </div>
        )
      ) : listError ? (
        <ErrorState message={listError.message} onRetry={reload} />
      ) : listLoading && list.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
      ) : list.length === 0 ? (
        isInactiveView ? (
          <EmptyState
            icon={<BellRing size={36} />}
            title="Nadie dejó de venir"
            description={`Aquí aparecen los ${terms.clients.toLowerCase()} que llevan más de 6 meses sin visita y no tienen nada agendado.`}
          />
        ) : (
          <EmptyState
            icon={<BellRing size={36} />}
            title="Hoy no hay a quién avisar"
            description={`Al registrar un ${terms.client.toLowerCase()} o terminar una cita, elige cuándo debe volver y aparecerá aquí ese día.`}
          />
        )
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((item) => (
            <FollowupCard
              key={item.opportunityId}
              item={item}
              badgeText={isInactiveView ? sinceLabel(item.daysOverdue) : undefined}
              sent={sentIds.includes(item.opportunityId)}
              busy={busyId === item.opportunityId}
              onWhatsApp={() => setWhatsappFor(item)}
              onBooked={() =>
                run(item, () => (isInactiveView ? resolveInactive(item.clientId, 'converted') : booked(item.opportunityId)))
              }
              onLater={() => setPostponeFor(item)}
              onNotInterested={() => setDiscardFor(item)}
            />
          ))}
        </div>
      )}

      {tomorrowFor && clientsById[tomorrowFor.clientId] && (
        <WhatsAppFollowupSheet
          key={tomorrowFor.id}
          open
          clientName={clientsById[tomorrowFor.clientId].name}
          initialMessage={appointmentConfirmMessage(
            company?.businessType,
            clientsById[tomorrowFor.clientId].name,
            company?.name ?? '',
            tomorrowFor.scheduledStartAt ? formatTimeInTimezone(tomorrowFor.scheduledStartAt, timezone) : ''
          )}
          onClose={() => setTomorrowFor(null)}
          onSend={(message) => {
            const c = clientsById[tomorrowFor.clientId];
            const number = toWhatsAppNumber(c.whatsapp || c.phone, timezone);
            window.open(buildWhatsAppLink(number, message), '_blank', 'noopener,noreferrer');
            markTomorrowSent(tomorrowFor.id);
            setTomorrowFor(null);
          }}
        />
      )}

      {whatsappFor && (
        <WhatsAppFollowupSheet
          key={whatsappFor.opportunityId}
          open
          clientName={whatsappFor.clientName}
          initialMessage={initialMessage(whatsappFor)}
          onClose={() => setWhatsappFor(null)}
          onSend={(message) => handleSend(whatsappFor, message)}
        />
      )}

      {postponeFor && (
        <PostponeModal
          key={postponeFor.opportunityId}
          open
          currentDueDate={addDaysToDateKey(getTodayKeyInTimezone(timezone), 7)}
          onClose={() => setPostponeFor(null)}
          onConfirm={(date) => {
            const item = postponeFor;
            run(item, () =>
              isInactiveView ? resolveInactive(item.clientId, 'postponed', date) : postpone(item.opportunityId, date)
            );
          }}
        />
      )}

      {discardFor && (
        <DiscardModal
          open
          onClose={() => setDiscardFor(null)}
          onConfirm={() => {
            const item = discardFor;
            run(item, () =>
              isInactiveView ? resolveInactive(item.clientId, 'discarded') : discard(item.opportunityId)
            );
          }}
        />
      )}
    </div>
  );
}
