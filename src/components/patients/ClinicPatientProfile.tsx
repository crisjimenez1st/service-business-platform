import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, MapPin, MessageCircle, Pencil, Phone } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorState } from '../ui';
import EditClientSheet from '../clients/EditClientSheet';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { useTerms } from '../../hooks/useTerms';
import { useSingleClientStore, useClientStore } from '../../store/clientStore';
import { getClientJobs } from '../../services/jobService';
import { getClientVisitRecords } from '../../services/visitRecordService';
import { formatCurrency } from '../../utils/currency';
import { buildWhatsAppLink } from '../../utils/whatsapp';
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from '../../utils/jobStatus';
import { formatLongDateInTimezone, formatTimeInTimezone } from '../../utils/timezone';
import { t } from '../../i18n/es';
import type { CurrencyCode, Job, VisitRecord } from '../../types';

/**
 * Ficha del paciente (clínicas): quién es, cuándo viene, qué se le ha hecho
 * y cuánto debe. Todo sale de las citas reales del paciente.
 */
export default function ClinicPatientProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCurrentCompany();
  const terms = useTerms();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';
  const canSeeMoney = company?.role === 'owner' || company?.role === 'office';

  const client = useSingleClientStore((s) => s.client);
  const loading = useSingleClientStore((s) => s.loading);
  const error = useSingleClientStore((s) => s.error);
  const loadClient = useSingleClientStore((s) => s.load);
  const setSingleClient = useSingleClientStore((s) => s.setClient);
  const updateClient = useClientStore((s) => s.updateClient);

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [records, setRecords] = useState<Record<string, VisitRecord>>({});
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (id && companyId) loadClient(id, companyId);
  }, [id, companyId, loadClient]);

  useEffect(() => {
    if (!id || !companyId) return;
    let cancelled = false;
    (async () => {
      const result = await getClientJobs(companyId, id);
      if (!cancelled) setJobs(result.error ? [] : result.data);
      const rec = await getClientVisitRecords(companyId, id);
      if (!cancelled && !rec.error) setRecords(rec.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, companyId]);

  const summary = useMemo(() => {
    const list = jobs ?? [];
    const nowIso = new Date().toISOString();
    const live = list.filter((j) => j.status !== 'cancelled' && j.scheduledStartAt);
    const upcoming = live
      .filter((j) => j.status !== 'completed' && (j.scheduledStartAt ?? '') >= nowIso)
      .sort((a, b) => (a.scheduledStartAt ?? '').localeCompare(b.scheduledStartAt ?? ''));
    const attended = live.filter((j) => j.status === 'completed');
    const last = [...attended].sort((a, b) => (b.scheduledStartAt ?? '').localeCompare(a.scheduledStartAt ?? ''))[0];
    const balances = new Map<CurrencyCode, number>();
    list.forEach((j) => {
      if (j.status === 'cancelled' || j.total === undefined) return;
      const owed = j.total - (j.paidAmount ?? 0);
      if (owed > 0) balances.set(j.currency, (balances.get(j.currency) ?? 0) + owed);
    });
    const history = [...list].sort((a, b) =>
      (b.scheduledStartAt ?? b.createdAt).localeCompare(a.scheduledStartAt ?? a.createdAt)
    );
    return { next: upcoming[0], last, attendedCount: attended.length, balances: [...balances.entries()], history };
  }, [jobs]);

  if (loading || !id || !companyId) {
    return <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>;
  }
  if (error) return <ErrorState message={error.message} onRetry={() => loadClient(id, companyId)} />;
  if (!client) return <EmptyState title={`${terms.client} no encontrado`} />;

  const dateTime = (iso?: string) =>
    iso ? `${formatLongDateInTimezone(iso, timezone)} · ${formatTimeInTimezone(iso, timezone)}` : '—';

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
            <p className="text-sm text-slate-500 mt-0.5">
              {terms.client} desde {formatLongDateInTimezone(client.createdAt, timezone)}
            </p>
            {client.address && (
              <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                <MapPin size={14} className="shrink-0" />
                <span className="truncate">{client.address}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setEditOpen(true)}
            aria-label="Editar datos del paciente"
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
            Llamar
          </a>
          <a
            href={buildWhatsAppLink(client.whatsapp, `Hola ${client.name.split(/\s+/)[0]} 👋`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 text-sm rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <MessageCircle size={16} />
            WhatsApp
          </a>
        </div>
      </Card>

      {jobs === null ? (
        <p className="text-center text-sm text-slate-500 py-8">{t.common.loading}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className={summary.next ? 'border-brand-200 bg-brand-50/60' : ''}>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <CalendarCheck size={14} /> Próxima cita
              </div>
              <p className="text-sm font-semibold text-slate-900 mt-1">{summary.next ? dateTime(summary.next.scheduledStartAt) : 'Sin cita agendada'}</p>
              {summary.next && <p className="text-xs text-slate-500 truncate">{summary.next.serviceType}</p>}
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Última visita</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                {summary.last ? formatLongDateInTimezone(summary.last.scheduledStartAt ?? '', timezone) : 'Aún sin visitas'}
              </p>
              {summary.last && <p className="text-xs text-slate-500 truncate">{summary.last.serviceType}</p>}
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Visitas atendidas</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{summary.attendedCount}</p>
            </Card>
            {canSeeMoney && (
              <Card className={summary.balances.length > 0 ? 'border-amber-200 bg-amber-50' : ''}>
                <p className="text-xs text-slate-500">Saldo pendiente</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">
                  {summary.balances.length === 0
                    ? 'Al día'
                    : summary.balances.map(([cur, amount]) => formatCurrency(amount, cur)).join(' · ')}
                </p>
              </Card>
            )}
          </div>

          {client.notes && (
            <Card>
              <p className="text-xs text-slate-500 mb-1">Notas del paciente</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{client.notes}</p>
            </Card>
          )}

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">Historial de atenciones</h2>
            {summary.history.length === 0 ? (
              <EmptyState title="Todavía no tiene citas" description="Cuando agendes una cita para este paciente, aparecerá aquí." />
            ) : (
              <ol className="space-y-2">
                {summary.history.map((job) => (
                  <li key={job.id}>
                    <button className="w-full text-left" onClick={() => navigate(`/jobs/${job.id}`)}>
                      <Card className="hover:border-brand-300 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-medium text-slate-900 truncate">{job.serviceType}</h3>
                            <p className="text-sm text-slate-500 mt-0.5">
                              {job.scheduledStartAt ? dateTime(job.scheduledStartAt) : 'Sin fecha'}
                            </p>
                          </div>
                          <Badge tone={JOB_STATUS_TONES[job.status]}>
                            {job.status === 'new' || job.status === 'scheduled' ? 'Agendada' : JOB_STATUS_LABELS[job.status]}
                          </Badge>
                        </div>
                        {records[job.id] && (
                          <div className="mt-2 space-y-1 text-sm text-slate-700">
                            {records[job.id].diagnosis && (
                              <p className="line-clamp-2"><span className="font-medium text-slate-900">Diagnóstico:</span> {records[job.id].diagnosis}</p>
                            )}
                            {records[job.id].treatment && (
                              <p className="line-clamp-2"><span className="font-medium text-slate-900">Tratamiento:</span> {records[job.id].treatment}</p>
                            )}
                            {records[job.id].nextSteps && (
                              <p className="line-clamp-2"><span className="font-medium text-slate-900">Próximos pasos:</span> {records[job.id].nextSteps}</p>
                            )}
                          </div>
                        )}
                        {job.notes && <p className="text-sm text-slate-600 mt-2 line-clamp-2">{job.notes}</p>}
                        {canSeeMoney && job.total !== undefined && job.status !== 'cancelled' && (
                          <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                            Precio {formatCurrency(job.total, job.currency)} · Pagado {formatCurrency(job.paidAmount ?? 0, job.currency)}
                          </p>
                        )}
                      </Card>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

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
