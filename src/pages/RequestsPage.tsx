import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, MessageCircle, Phone } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState } from '../components/ui';
import NewAppointmentSheet from '../components/calendar/NewAppointmentSheet';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientsById } from '../hooks/useClientsById';
import { useTerms } from '../hooks/useTerms';
import { useClientStore } from '../store/clientStore';
import { useServiceRulesStore } from '../store/serviceRulesStore';
import { createAppointment } from '../services/appointmentService';
import { getAppointmentRequests, resolveAppointmentRequest } from '../services/bookingService';
import type { ServiceError } from '../services/errors/serviceError';
import { buildWhatsAppLink, toWhatsAppNumber } from '../utils/whatsapp';
import { formatShortDateInTimezone, formatTimeInTimezone } from '../utils/timezone';
import type { AppointmentRequest } from '../types';

/** Solicitudes de cita que llegaron por el enlace público (solo dueño y recepción). */
export default function RequestsPage() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';
  const terms = useTerms();
  const { clients } = useClientsById();
  const createClient = useClientStore((s) => s.createClient);
  const rules = useServiceRulesStore((s) => s.rules);
  const loadRules = useServiceRulesStore((s) => s.load);

  const [items, setItems] = useState<AppointmentRequest[] | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [scheduling, setScheduling] = useState<{ req: AppointmentRequest; clientId: string | null } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!companyId) return;
    const r = await getAppointmentRequests(companyId);
    if (r.error) setError(r.error);
    else {
      setError(null);
      setItems(r.data);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    loadRules(companyId);
    (async () => {
      const r = await getAppointmentRequests(companyId);
      if (cancelled) return;
      if (r.error) setError(r.error);
      else setItems(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, loadRules]);

  const visible = useMemo(
    () => (items ?? []).filter((r) => (showDone ? r.status !== 'pending' : r.status === 'pending')),
    [items, showDone],
  );

  if (!company || (company.role !== 'owner' && company.role !== 'office')) {
    return <EmptyState title="Sin acceso" description="Las solicitudes las ve el dueño o la recepción." />;
  }

  function findClientId(req: AppointmentRequest): string | null {
    const match = clients.find((c) => c.phone.replace(/\D/g, '').slice(-8) === req.phoneKey);
    return match?.id ?? null;
  }

  async function resolve(req: AppointmentRequest, status: 'handled' | 'dismissed') {
    setActionError(null);
    const r = await resolveAppointmentRequest(req.id, status);
    if (r.error) setActionError(r.error.message);
    else await reload();
  }

  async function startScheduling(req: AppointmentRequest) {
    setActionError(null);
    let clientId = findClientId(req);
    if (!clientId) {
      const created = await createClient({ name: req.name, phone: req.phone });
      clientId = created?.id ?? null;
      if (!clientId) {
        setActionError(`No se pudo crear al ${terms.client.toLowerCase()}. Intenta de nuevo.`);
        return;
      }
    }
    setScheduling({ req, clientId });
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Solicitudes de cita</h1>
        <button type="button" onClick={() => setShowDone((v) => !v)} className="text-sm font-medium text-brand-700 min-h-9">
          {showDone ? 'Ver nuevas' : 'Ver atendidas'}
        </button>
      </div>

      {actionError && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{actionError}</p>}

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : items === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Inbox size={32} />}
          title={showDone ? 'Aún no has atendido solicitudes' : 'No hay solicitudes nuevas'}
          description={showDone ? undefined : 'Cuando un paciente pida cita desde tu enlace, aparecerá aquí. Lo encuentras en Ajustes.'}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => {
            const known = findClientId(r);
            const wa = buildWhatsAppLink(
              toWhatsAppNumber(r.phone, timezone),
              `Hola ${r.name.split(' ')[0]} 👋 Recibimos tu solicitud de cita en ${company.name}. ¿Te queda bien agendarla pronto?`,
            );
            return (
              <li key={r.id}>
                <Card>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{r.name}</p>
                        <p className="text-sm text-slate-500">
                          {r.phone} · {formatShortDateInTimezone(r.createdAt, timezone)} {formatTimeInTimezone(r.createdAt, timezone)}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {known && <Badge>{terms.client} existente</Badge>}
                        {r.status !== 'pending' && <Badge>{r.status === 'handled' ? 'Atendida' : 'Descartada'}</Badge>}
                      </div>
                    </div>
                    <dl className="text-sm space-y-1">
                      <div><dt className="inline text-slate-500">Necesita: </dt><dd className="inline text-slate-900">{r.service}</dd></div>
                      {r.preferred && <div><dt className="inline text-slate-500">Le queda bien: </dt><dd className="inline text-slate-900">{r.preferred}</dd></div>}
                      {r.note && <div><dt className="inline text-slate-500">Nota: </dt><dd className="inline text-slate-900">{r.note}</dd></div>}
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <MessageCircle size={16} className="mr-1.5" /> WhatsApp
                      </a>
                      <a href={`tel:${r.phone}`} className="inline-flex items-center min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Phone size={16} className="mr-1.5" /> Llamar
                      </a>
                      {r.status === 'pending' && (
                        <>
                          <Button onClick={() => startScheduling(r)}>Agendar cita</Button>
                          <Button variant="secondary" onClick={() => resolve(r, 'handled')}>Listo</Button>
                          <Button variant="ghost" onClick={() => resolve(r, 'dismissed')}>Descartar</Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {scheduling && companyId && (
        <NewAppointmentSheet
          open
          clients={clients}
          clientLabel={terms.client}
          serviceOptions={rules.map((x) => x.serviceName)}
          timezone={timezone}
          currency={company.currency === 'USD' ? 'USD' : 'NIO'}
          initialClientId={scheduling.clientId}
          initialService={scheduling.req.service}
          onClose={() => setScheduling(null)}
          onCreateClient={async ({ name, phone }) => (await createClient({ name, phone }))?.id ?? null}
          onSave={async (input) => {
            const result = await createAppointment(companyId, input);
            if (result.error) return result.error.message;
            await resolveAppointmentRequest(scheduling.req.id, 'handled');
            await reload();
            return null;
          }}
        />
      )}
    </div>
  );
}
