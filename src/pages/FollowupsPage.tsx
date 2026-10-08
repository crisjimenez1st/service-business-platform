import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BellRing, Plus } from 'lucide-react';
import { Button, EmptyState, ErrorState } from '../components/ui';
import FilterChips from '../components/clients/FilterChips';
import FollowupCard from '../components/followups/FollowupCard';
import TomorrowCard from '../components/followups/TomorrowCard';
import WaitlistCard from '../components/followups/WaitlistCard';
import AddToWaitlistSheet from '../components/followups/AddToWaitlistSheet';
import WhatsAppFollowupSheet from '../components/followups/WhatsAppFollowupSheet';
import PostponeModal from '../components/opportunities/PostponeModal';
import DiscardModal from '../components/opportunities/DiscardModal';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useFollowupStore } from '../store/followupStore';
import { useTomorrowStore } from '../store/tomorrowStore';
import { useWaitlistStore } from '../store/waitlistStore';
import { useServiceRulesStore } from '../store/serviceRulesStore';
import { useClientsById } from '../hooks/useClientsById';
import { buildAppointmentLink } from '../services/appointmentService';
import { useTerms } from '../hooks/useTerms';
import { followupMessage, inactiveMessage, appointmentConfirmMessage, waitlistMessage } from '../i18n/businessTerms';
import { buildWhatsAppLink, toWhatsAppNumber } from '../utils/whatsapp';
import { addDaysToDateKey } from '../utils/followupDates';
import { getTodayKeyInTimezone, formatTimeInTimezone, formatLongDateInTimezone } from '../utils/timezone';
import { t } from '../i18n/es';
import type { FollowupDue, Job } from '../types';

type View = 'today' | 'tomorrow' | 'inactive' | 'waitlist';

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
  const { clients, clientsById } = useClientsById();
  const [searchParams] = useSearchParams();
  const slotParam = searchParams.get('slot');
  const slotText = slotParam
    ? `el ${formatLongDateInTimezone(slotParam, timezone)} a las ${formatTimeInTimezone(slotParam, timezone)}`
    : '';

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
  const tomorrowResponses = useTomorrowStore((s) => s.responses);
  const tomorrowLoading = useTomorrowStore((s) => s.loading);
  const tomorrowError = useTomorrowStore((s) => s.error);
  const loadTomorrow = useTomorrowStore((s) => s.load);
  const prepareTomorrowLink = useTomorrowStore((s) => s.prepareLink);
  const markTomorrowReminded = useTomorrowStore((s) => s.markReminded);
  const setTomorrowResponse = useTomorrowStore((s) => s.setResponse);
  const [tomorrowFor, setTomorrowFor] = useState<{ job: Job; link: string } | null>(null);
  const [tomorrowBusyId, setTomorrowBusyId] = useState<string | null>(null);
  const [tomorrowActionError, setTomorrowActionError] = useState<string | null>(null);

  async function startReminder(job: Job) {
    setTomorrowActionError(null);
    setTomorrowBusyId(job.id);
    const { token, error: linkError } = await prepareTomorrowLink(job.id);
    setTomorrowBusyId(null);
    if (linkError || !token) {
      setTomorrowActionError(linkError?.message ?? 'No pudimos preparar el recordatorio.');
      return;
    }
    setTomorrowFor({ job, link: buildAppointmentLink(token) });
  }

  async function respond(job: Job, response: 'confirmed' | 'declined' | null) {
    setTomorrowActionError(null);
    setTomorrowBusyId(job.id);
    const err = await setTomorrowResponse(job.id, response);
    setTomorrowBusyId(null);
    if (err) setTomorrowActionError(err.message);
  }

  const serviceRules = useServiceRulesStore((s) => s.rules);
  const loadServiceRules = useServiceRulesStore((s) => s.load);
  const waitlist = useWaitlistStore((s) => s.entries);
  const waitlistSent = useWaitlistStore((s) => s.sentIds);
  const waitlistLoading = useWaitlistStore((s) => s.loading);
  const waitlistError = useWaitlistStore((s) => s.error);
  const loadWaitlist = useWaitlistStore((s) => s.load);
  const addToWaitlist = useWaitlistStore((s) => s.add);
  const resolveWaitlist = useWaitlistStore((s) => s.resolve);
  const markWaitlistSent = useWaitlistStore((s) => s.markSent);
  const [waitlistFor, setWaitlistFor] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [waitlistActionError, setWaitlistActionError] = useState<string | null>(null);

  const [view, setView] = useState<View>(
    (['today', 'tomorrow', 'inactive', 'waitlist'] as const).find((v) => v === searchParams.get('tab')) ?? 'today'
  );
  const [whatsappFor, setWhatsappFor] = useState<FollowupDue | null>(null);
  const [postponeFor, setPostponeFor] = useState<FollowupDue | null>(null);
  const [discardFor, setDiscardFor] = useState<FollowupDue | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) {
      load(companyId);
      loadInactive(companyId);
      loadTomorrow(companyId, timezone);
      loadWaitlist(companyId);
      loadServiceRules(companyId);
    }
  }, [companyId, timezone, load, loadInactive, loadTomorrow, loadWaitlist, loadServiceRules]);

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
    { value: 'waitlist' as View, label: `Lista de espera${waitlist.length > 0 ? ` (${waitlist.length})` : ''}` },
    { value: 'inactive' as View, label: `Hace tiempo que no vienen${inactive.length > 0 ? ` (${inactive.length})` : ''}` },
  ];

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{terms.followupsToday}</h1>
        {view !== 'tomorrow' && view !== 'waitlist' && !listLoading && !listError && list.length > 0 && (
          <p className="text-sm text-slate-500 mt-0.5">
            {list.length === 1 ? '1 persona para avisar' : `${list.length} personas para avisar`}
          </p>
        )}
      </div>

      <FilterChips options={filterOptions} active={view} onChange={setView} />

      {view === 'waitlist' ? (
        <div className="space-y-3">
          <Button size="sm" variant="secondary" icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
            Agregar a la lista de espera
          </Button>
          {waitlistActionError && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {waitlistActionError}
            </p>
          )}
          {slotText && (
            <p className="text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
              Se liberó un espacio {slotText}. Avisa a quien esté esperando.
            </p>
          )}
          {waitlistError ? (
            <ErrorState message={waitlistError.message} onRetry={() => companyId && loadWaitlist(companyId)} />
          ) : waitlistLoading && waitlist.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
          ) : waitlist.length === 0 ? (
            <EmptyState
              icon={<BellRing size={36} />}
              title="Nadie en lista de espera"
              description="Agrega a quien quiera una cita antes. Cuando se libere un espacio, lo avisas con un toque."
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {waitlist.map((entry) => {
                const client = clientsById[entry.clientId];
                return (
                  <WaitlistCard
                    key={entry.id}
                    name={client?.name ?? '—'}
                    phone={client?.whatsapp || client?.phone || ''}
                    note={entry.note}
                    service={entry.service}
                    createdAt={entry.createdAt}
                    sent={waitlistSent.includes(entry.id)}
                    busy={false}
                    onWhatsApp={() => client && setWaitlistFor(entry.id)}
                    onBooked={async () => setWaitlistActionError((await resolveWaitlist(entry.id, 'booked'))?.message ?? null)}
                    onRemove={async () => setWaitlistActionError((await resolveWaitlist(entry.id, 'removed'))?.message ?? null)}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : view === 'tomorrow' ? (
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
          <div className="space-y-3">
            {tomorrowActionError && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {tomorrowActionError}
              </p>
            )}
          <div className="grid sm:grid-cols-2 gap-3">
            {tomorrowJobs.map((job) => {
              const client = clientsById[job.clientId];
              const resp = tomorrowResponses[job.id];
              const status = resp?.response ?? (resp?.remindedAt ? 'reminded' : 'pending');
              return (
                <TomorrowCard
                  key={job.id}
                  clientName={client?.name ?? '—'}
                  phone={client?.whatsapp || client?.phone || ''}
                  timeText={job.scheduledStartAt ? formatTimeInTimezone(job.scheduledStartAt, timezone) : ''}
                  serviceType={job.serviceType}
                  status={status}
                  source={resp?.responseSource}
                  busy={tomorrowBusyId === job.id}
                  onWhatsApp={() => client && startReminder(job)}
                  onConfirmed={() => respond(job, 'confirmed')}
                  onDeclined={() => respond(job, 'declined')}
                  onClear={() => respond(job, null)}
                  onReschedule={() => navigate(`/jobs/${job.id}`)}
                  onOfferSlot={() =>
                    navigate(`/followups?tab=waitlist&slot=${encodeURIComponent(job.scheduledStartAt ?? '')}`)
                  }
                />
              );
            })}
          </div>
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

      {addOpen && (
        <AddToWaitlistSheet
          open
          clients={clients}
          excludeClientIds={waitlist.map((w) => w.clientId)}
          clientLabel={terms.client}
          serviceOptions={serviceRules.map((r) => r.serviceName)}
          onClose={() => setAddOpen(false)}
          onSave={async (input) => (await addToWaitlist(input))?.message ?? null}
        />
      )}

      {waitlistFor && (() => {
        const entry = waitlist.find((w) => w.id === waitlistFor);
        const client = entry ? clientsById[entry.clientId] : undefined;
        if (!entry || !client) return null;
        return (
          <WhatsAppFollowupSheet
            key={entry.id}
            open
            clientName={client.name}
            initialMessage={waitlistMessage(company?.businessType, client.name, company?.name ?? '', slotText, entry.service)}
            onClose={() => setWaitlistFor(null)}
            onSend={(message) => {
              const number = toWhatsAppNumber(client.whatsapp || client.phone, timezone);
              window.open(buildWhatsAppLink(number, message), '_blank', 'noopener,noreferrer');
              markWaitlistSent(entry.id);
              setWaitlistFor(null);
            }}
          />
        );
      })()}

      {tomorrowFor && clientsById[tomorrowFor.job.clientId] && (
        <WhatsAppFollowupSheet
          key={tomorrowFor.job.id}
          open
          clientName={clientsById[tomorrowFor.job.clientId].name}
          initialMessage={appointmentConfirmMessage(
            company?.businessType,
            clientsById[tomorrowFor.job.clientId].name,
            company?.name ?? '',
            tomorrowFor.job.scheduledStartAt ? formatTimeInTimezone(tomorrowFor.job.scheduledStartAt, timezone) : '',
            tomorrowFor.link
          )}
          onClose={() => setTomorrowFor(null)}
          onSend={(message) => {
            const target = tomorrowFor;
            const c = clientsById[target.job.clientId];
            const number = toWhatsAppNumber(c.whatsapp || c.phone, timezone);
            window.open(buildWhatsAppLink(number, message), '_blank', 'noopener,noreferrer');
            markTomorrowReminded(target.job.id);
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
