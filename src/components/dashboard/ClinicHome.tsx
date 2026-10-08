import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, CalendarCheck, Cake, Inbox, ChevronRight, Wallet, UserRoundCheck } from 'lucide-react';
import { Badge, Card, ErrorState } from '../ui';
import NewAppointmentButton from '../calendar/NewAppointmentButton';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { useClientsById } from '../../hooks/useClientsById';
import { useTerms } from '../../hooks/useTerms';
import { useFollowupStore } from '../../store/followupStore';
import * as jobService from '../../services/jobService';
import { getAppointmentResponses } from '../../services/appointmentService';
import { countPendingRequests } from '../../services/bookingService';
import { getReceivablesSummary } from '../../services/paymentService';
import type { ServiceError } from '../../services/errors/serviceError';
import { nextBirthday } from '../../utils/birthdays';
import { addDaysToDateKey } from '../../utils/followupDates';
import { formatCurrency } from '../../utils/currency';
import {
  formatLongDateInTimezone,
  formatTimeInTimezone,
  getLocalHourInTimezone,
  getTodayKeyInTimezone,
  localDateTimeToTimezoneIso,
} from '../../utils/timezone';
import type { AppointmentResponse, CurrencyCode, Job } from '../../types';

interface DayData {
  today: Job[];
  tomorrow: Job[];
  responses: Record<string, AppointmentResponse>;
}

/**
 * Inicio de clínica: el día de la clínica de un vistazo. Todo lo que la
 * recepción necesita al abrir la app: quién viene hoy y quién confirmó,
 * a quién avisar, cuántas citas hay mañana y qué falta por cobrar.
 */
export default function ClinicHome() {
  const navigate = useNavigate();
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';
  const terms = useTerms();
  const { clients, clientsById } = useClientsById();
  const canSeeMoney = company?.role === 'owner' || company?.role === 'office';

  const followupCount = useFollowupStore((s) => s.items.length);
  const inactiveCount = useFollowupStore((s) => s.inactive.length);
  const loadFollowups = useFollowupStore((s) => s.load);
  const loadInactive = useFollowupStore((s) => s.loadInactive);

  const [day, setDay] = useState<DayData | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [owed, setOwed] = useState<{ currency: CurrencyCode; outstanding: number }[] | null>(null);

  useEffect(() => {
    if (companyId && canSeeMoney) {
      loadFollowups(companyId);
      loadInactive(companyId);
    }
  }, [companyId, canSeeMoney, loadFollowups, loadInactive]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const todayKey = getTodayKeyInTimezone(timezone);
      const start = localDateTimeToTimezoneIso(`${todayKey}T00:00`, timezone);
      const end = localDateTimeToTimezoneIso(`${addDaysToDateKey(todayKey, 2)}T00:00`, timezone);
      const midnight = localDateTimeToTimezoneIso(`${addDaysToDateKey(todayKey, 1)}T00:00`, timezone);
      const jobsResult = await jobService.getJobsInRange(companyId, start, end);
      if (cancelled) return;
      if (jobsResult.error) {
        setError(jobsResult.error);
        return;
      }
      const live = jobsResult.data
        .filter((j) => j.scheduledStartAt && j.status !== 'cancelled')
        .sort((a, b) => (a.scheduledStartAt ?? '').localeCompare(b.scheduledStartAt ?? ''));
      const resp = await getAppointmentResponses(companyId, live.map((j) => j.id));
      if (cancelled) return;
      const responses: Record<string, AppointmentResponse> = {};
      if (!resp.error) resp.data.forEach((r) => (responses[r.jobId] = r));
      setError(null);
      setDay({
        today: live.filter((j) => (j.scheduledStartAt ?? '') < midnight),
        tomorrow: live.filter((j) => (j.scheduledStartAt ?? '') >= midnight && j.status !== 'completed'),
        responses,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, timezone, reloadKey]);

  useEffect(() => {
    if (!companyId || !canSeeMoney) return;
    let cancelled = false;
    countPendingRequests(companyId).then((r) => {
      if (!cancelled && !r.error) setRequestCount(r.data);
    });
    getReceivablesSummary(companyId).then((r) => {
      if (!cancelled && !r.error) setOwed(r.data.map((x) => ({ currency: x.currency, outstanding: x.outstanding })));
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, canSeeMoney, reloadKey]);

  const greeting = useMemo(() => {
    const h = getLocalHourInTimezone(new Date().toISOString(), timezone);
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }, [timezone]);

  const birthdaysToday = useMemo(() => {
    const todayKey = getTodayKeyInTimezone(timezone);
    return clients.filter((cl) => cl.birthDate && nextBirthday(cl.birthDate, todayKey)?.daysUntil === 0).length;
  }, [clients, timezone]);

  const todayLabel = formatLongDateInTimezone(new Date().toISOString(), timezone);
  const tomorrowPending = day ? day.tomorrow.filter((j) => !day.responses[j.id]?.response).length : 0;
  const owedText =
    owed === null
      ? '…'
      : owed.filter((o) => o.outstanding > 0).length === 0
        ? 'Al día'
        : owed
            .filter((o) => o.outstanding > 0)
            .map((o) => formatCurrency(o.outstanding, o.currency))
            .join(' · ');

  return (
    <div className="space-y-6 pb-4">
      <div className="relative overflow-hidden md:ml-24 lg:ml-0 lg:max-w-4xl rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 text-white p-5 sm:p-6 shadow-sm">
        <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div aria-hidden="true" className="absolute right-12 -bottom-14 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-brand-100">{greeting}</p>
            <h1 className="font-brand text-2xl sm:text-3xl font-semibold leading-tight break-words">{company?.name}</h1>
            <p className="text-sm text-brand-100 capitalize mt-1">{todayLabel}</p>
          </div>
          <NewAppointmentButton
            className="!bg-white !text-brand-700 hover:!bg-brand-50 shadow-sm"
            onCreated={() => setReloadKey((k) => k + 1)}
          />
        </div>
      </div>

      {/* Lo que pide atención */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AttentionTile
          icon={<Cake size={20} />}
          label="Cumpleaños de hoy"
          value={birthdaysToday === 0 ? 'Nadie' : `${birthdaysToday} ${birthdaysToday === 1 ? 'persona' : 'personas'}`}
          highlight={birthdaysToday > 0}
          onClick={() => navigate('/birthdays')}
          hidden={!canSeeMoney}
        />
        <AttentionTile
          icon={<Inbox size={20} />}
          label="Solicitudes de cita"
          value={requestCount === 0 ? 'Ninguna' : `${requestCount} ${requestCount === 1 ? 'nueva' : 'nuevas'}`}
          highlight={requestCount > 0}
          onClick={() => navigate('/requests')}
          hidden={!canSeeMoney}
        />
        <AttentionTile
          icon={<BellRing size={20} />}
          label="Hoy toca avisar"
          value={followupCount === 0 ? 'Nadie' : `${followupCount} ${followupCount === 1 ? 'persona' : 'personas'}`}
          highlight={followupCount > 0}
          onClick={() => navigate('/followups')}
          hidden={!canSeeMoney}
        />
        <AttentionTile
          icon={<UserRoundCheck size={20} />}
          label={`${terms.clients} por recuperar`}
          value={inactiveCount === 0 ? 'Ninguno' : String(inactiveCount)}
          highlight={inactiveCount > 0}
          onClick={() => navigate('/followups?tab=inactive')}
          hidden={!canSeeMoney}
        />
        <AttentionTile
          icon={<Wallet size={20} />}
          label="Pagos pendientes"
          value={owedText}
          highlight={false}
          onClick={() => navigate('/collections')}
          hidden={!canSeeMoney}
        />
      </div>

      {/* Citas de hoy */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">Citas de hoy</h2>
          <button type="button" onClick={() => navigate('/calendar')} className="text-sm font-medium text-brand-700 min-h-9">
            Ver agenda
          </button>
        </div>
        {error ? (
          <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : day === null ? (
          <p className="text-center text-sm text-slate-500 py-8">Cargando…</p>
        ) : day.today.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 text-center py-4">No hay citas para hoy. Usa “Nueva cita” para agendar una.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {day.today.map((job) => (
              <AppointmentRow
                key={job.id}
                job={job}
                name={clientsById[job.clientId]?.name ?? '—'}
                time={formatTimeInTimezone(job.scheduledStartAt ?? '', timezone)}
                response={day.responses[job.id]}
                onClick={() => navigate(`/jobs/${job.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Mañana */}
      {day && (
        <button
          type="button"
          onClick={() => navigate('/followups?tab=tomorrow')}
          className="block w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Card className="transition-colors hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="text-brand-600">
                <CalendarCheck size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-500">Mañana</p>
                <p className="text-base font-semibold text-slate-900">
                  {day.tomorrow.length === 0
                    ? 'Sin citas agendadas'
                    : `${day.tomorrow.length} ${day.tomorrow.length === 1 ? 'cita' : 'citas'}${
                        tomorrowPending > 0 ? ` · ${tomorrowPending} sin confirmar` : ' · todas confirmadas'
                      }`}
                </p>
              </div>
              <ChevronRight size={20} className="text-slate-400" />
            </div>
          </Card>
        </button>
      )}
    </div>
  );
}

function AttentionTile({
  icon,
  label,
  value,
  highlight,
  onClick,
  hidden,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight: boolean;
  onClick: () => void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <Card className={['h-full transition-colors hover:bg-slate-50', highlight ? 'border-brand-200 bg-brand-50/60' : ''].join(' ')}>
        <div className="flex items-center gap-3">
          <div className="text-brand-600 shrink-0">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">{label}</p>
            <p className="text-base sm:text-lg font-semibold text-slate-900 truncate">{value}</p>
          </div>
        </div>
      </Card>
    </button>
  );
}

function AppointmentRow({
  job,
  name,
  time,
  response,
  onClick,
}: {
  job: Job;
  name: string;
  time: string;
  response: AppointmentResponse | undefined;
  onClick: () => void;
}) {
  const done = job.status === 'completed';
  const badge = done
    ? { text: 'Atendida', tone: 'success' as const }
    : response?.response === 'confirmed'
      ? { text: 'Confirmó', tone: 'success' as const }
      : response?.response === 'declined'
        ? { text: 'No podrá', tone: 'warning' as const }
        : response?.remindedAt
          ? { text: 'Recordada', tone: 'info' as const }
          : { text: 'Sin confirmar', tone: 'neutral' as const };
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <Card className="transition-colors hover:bg-slate-50">
        <div className="flex items-center gap-3">
          <p className="w-20 shrink-0 text-sm font-semibold text-brand-700">{time}</p>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
            <p className="text-xs text-slate-500 truncate">{job.serviceType}</p>
          </div>
          <Badge tone={badge.tone}>{badge.text}</Badge>
        </div>
      </Card>
    </button>
  );
}
