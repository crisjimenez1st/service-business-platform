import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Star } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState } from '../components/ui';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientsById } from '../hooks/useClientsById';
import { useTerms } from '../hooks/useTerms';
import { useClientStore } from '../store/clientStore';
import * as jobService from '../services/jobService';
import type { ServiceError } from '../services/errors/serviceError';
import { addDaysToDateKey } from '../utils/followupDates';
import { formatShortDateInTimezone, getTodayKeyInTimezone, localDateTimeToTimezoneIso } from '../utils/timezone';
import { buildWhatsAppLink, toWhatsAppNumber } from '../utils/whatsapp';
import type { Job } from '../types';

const DAYS_BACK = 30;

/** Pacientes atendidos en los últimos 30 días a quienes se les puede ofrecer dejar una reseña. */
export default function ReviewsPage() {
  const navigate = useNavigate();
  const { company } = useCurrentCompany();
  const terms = useTerms();
  const { clientsById } = useClientsById();
  const updateClient = useClientStore((s) => s.updateClient);
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showAsked, setShowAsked] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const todayKey = getTodayKeyInTimezone(timezone);
      const start = localDateTimeToTimezoneIso(`${addDaysToDateKey(todayKey, -DAYS_BACK)}T00:00`, timezone);
      const end = localDateTimeToTimezoneIso(`${addDaysToDateKey(todayKey, 1)}T00:00`, timezone);
      const r = await jobService.getJobsInRange(companyId, start, end);
      if (cancelled) return;
      if (r.error) setError(r.error);
      else {
        setError(null);
        setJobs(r.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, timezone, reloadKey]);

  // Un renglón por paciente, con su última cita atendida.
  const rows = useMemo(() => {
    const latest = new Map<string, Job>();
    (jobs ?? [])
      .filter((j) => j.status === 'completed' && j.scheduledStartAt)
      .forEach((j) => {
        const prev = latest.get(j.clientId);
        if (!prev || (j.scheduledStartAt as string) > (prev.scheduledStartAt as string)) latest.set(j.clientId, j);
      });
    return [...latest.values()]
      .map((j) => ({ job: j, client: clientsById[j.clientId] }))
      .filter((x) => x.client && x.client.contactConsent !== false)
      .sort((a, b) => (b.job.scheduledStartAt as string).localeCompare(a.job.scheduledStartAt as string));
  }, [jobs, clientsById]);

  if (!company || (company.role !== 'owner' && company.role !== 'office')) {
    return <EmptyState title="Sin acceso" description="Las reseñas las gestiona el dueño o la recepción." />;
  }

  if (!company.reviewUrl) {
    return (
      <div className="space-y-4 pb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Reseñas</h1>
        <EmptyState
          icon={<Star size={32} />}
          title="Primero pega tu enlace de reseñas"
          description="Se hace una sola vez, en Ajustes. Después podrás ofrecer una reseña a cada paciente atendido."
        />
        <div className="flex justify-center">
          <Button onClick={() => navigate('/settings')}>Ir a Ajustes</Button>
        </div>
      </div>
    );
  }

  const pending = rows.filter((x) => !x.client.reviewAskedAt);
  const asked = rows.filter((x) => x.client.reviewAskedAt);
  const visible = showAsked ? asked : pending;
  const reviewUrl = company.reviewUrl;

  async function ask(clientId: string) {
    await updateClient(clientId, { reviewAskedAt: new Date().toISOString() });
    setReloadKey((n) => n + 1);
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Reseñas</h1>
        <button type="button" onClick={() => setShowAsked((v) => !v)} className="text-sm font-medium text-brand-700 min-h-9">
          {showAsked ? 'Ver por pedir' : 'Ver ya pedidas'}
        </button>
      </div>
      <p className="text-sm text-slate-600">
        {terms.clients} atendidos en los últimos {DAYS_BACK} días. Ofrece la reseña a quien quedó contento.
      </p>

      {error ? (
        <ErrorState message={error.message} onRetry={() => setReloadKey((n) => n + 1)} />
      ) : jobs === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Star size={32} />}
          title={showAsked ? 'Aún no has pedido reseñas' : 'No hay nadie por pedirle reseña'}
          description={showAsked ? undefined : 'Cuando marques citas como atendidas, sus pacientes aparecerán aquí.'}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map(({ job, client }) => {
            const first = client.name.split(' ')[0];
            const wa = buildWhatsAppLink(
              toWhatsAppNumber(client.whatsapp || client.phone, timezone),
              `Hola ${first} 👋 Gracias por visitarnos en ${company.name}. Si quedaste contento con la atención, nos ayudaría muchísimo que dejaras tu opinión aquí:\n${reviewUrl}\n¡Gracias!`,
            );
            return (
              <li key={client.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{client.name}</p>
                      <p className="text-sm text-slate-500">
                        {job.serviceType} · {formatShortDateInTimezone(job.scheduledStartAt as string, timezone)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {client.reviewAskedAt && (
                        <Badge>Pedida {formatShortDateInTimezone(client.reviewAskedAt, timezone)}</Badge>
                      )}
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => ask(client.id)}
                        className="inline-flex items-center min-h-11 px-3 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
                      >
                        <MessageCircle size={16} className="mr-1.5" /> {client.reviewAskedAt ? 'Pedir otra vez' : 'Pedir reseña'}
                      </a>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
