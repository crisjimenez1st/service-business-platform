import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, ChevronLeft, ChevronRight, ClipboardList, UserPlus, XCircle } from 'lucide-react';
import { Card, EmptyState, ErrorState } from '../components/ui';
import MetricCard from '../components/dashboard/MetricCard';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientsById } from '../hooks/useClientsById';
import { useTerms } from '../hooks/useTerms';
import * as jobService from '../services/jobService';
import type { ServiceError } from '../services/errors/serviceError';
import { addMonthsToDateKey } from '../utils/followupDates';
import { formatCurrency } from '../utils/currency';
import { formatShortDateInTimezone, getTodayKeyInTimezone, localDateTimeToTimezoneIso } from '../utils/timezone';
import type { CurrencyCode, Job } from '../types';

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const label = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Registro del mes: a quién se atendió en el mes elegido, cuántas citas
 * hubo y cuántos pacientes nuevos llegaron. Es el libro de pacientes de la clínica.
 */
export default function MonthlyRegistryPage() {
  const navigate = useNavigate();
  const { company } = useCurrentCompany();
  const terms = useTerms();
  const { clientsById, clients } = useClientsById();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';
  const canSeeMoney = company?.role === 'owner' || company?.role === 'office';

  const [monthKey, setMonthKey] = useState(() => getTodayKeyInTimezone(timezone).slice(0, 7) + '-01');
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const start = localDateTimeToTimezoneIso(`${monthKey}T00:00`, timezone);
  const end = localDateTimeToTimezoneIso(`${addMonthsToDateKey(monthKey, 1)}T00:00`, timezone);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const result = await jobService.getJobsInRange(companyId, start, end);
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setJobs(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, start, end, reloadKey]);

  const data = useMemo(() => {
    const list = (jobs ?? []).filter((j) => j.scheduledStartAt);
    const live = list.filter((j) => j.status !== 'cancelled');
    const cancelled = list.length - live.length;
    const byPatient = new Map<string, { visits: number; attended: number; last: string; services: Set<string> }>();
    live.forEach((j) => {
      const row = byPatient.get(j.clientId) ?? { visits: 0, attended: 0, last: '', services: new Set<string>() };
      row.visits += 1;
      if (j.status === 'completed') row.attended += 1;
      if ((j.scheduledStartAt ?? '') > row.last) row.last = j.scheduledStartAt ?? '';
      row.services.add(j.serviceType);
      byPatient.set(j.clientId, row);
    });
    const rows = [...byPatient.entries()].sort((a, b) => b[1].last.localeCompare(a[1].last));
    const billed = new Map<CurrencyCode, number>();
    live.forEach((j) => {
      if (j.total) billed.set(j.currency, (billed.get(j.currency) ?? 0) + j.total);
    });
    const newPatients = clients.filter((c) => c.createdAt >= start && c.createdAt < end).length;
    return { rows, visits: live.length, cancelled, newPatients, billed: [...billed.entries()] };
  }, [jobs, clients, start, end]);

  const thisMonth = getTodayKeyInTimezone(timezone).slice(0, 7) + '-01';

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Registro del mes</h1>
        <p className="text-sm text-slate-500 mt-0.5">Los {terms.clients.toLowerCase()} que atendiste, mes por mes.</p>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => { setJobs(null); setMonthKey(addMonthsToDateKey(monthKey, -1)); }}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-xl text-slate-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="font-semibold text-slate-900">{monthLabel(monthKey)}</p>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={monthKey >= thisMonth}
          onClick={() => { setJobs(null); setMonthKey(addMonthsToDateKey(monthKey, 1)); }}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-xl text-slate-600 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : jobs === null ? (
        <p className="text-center text-sm text-slate-500 py-10">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label={`${terms.clients} atendidos`} value={String(data.rows.length)} icon={<ClipboardList size={18} />} emphasis />
            <MetricCard label="Citas del mes" value={String(data.visits)} icon={<CalendarCheck size={18} />} />
            <MetricCard label={`${terms.clients} nuevos`} value={String(data.newPatients)} icon={<UserPlus size={18} />} />
            <MetricCard label="Canceladas" value={String(data.cancelled)} icon={<XCircle size={18} />} />
          </div>
          {canSeeMoney && data.billed.length > 0 && (
            <p className="text-xs text-slate-500">
              Valor de las citas del mes: {data.billed.map(([cur, v]) => formatCurrency(v, cur)).join(' · ')}
            </p>
          )}

          {data.rows.length === 0 ? (
            <EmptyState title="Sin citas en este mes" description="Cuando agendes citas en este mes, los pacientes aparecerán aquí." />
          ) : (
            <ul className="space-y-2">
              {data.rows.map(([clientId, row]) => (
                <li key={clientId}>
                  <button className="w-full text-left" onClick={() => navigate(`/clients/${clientId}`)}>
                    <Card className="hover:border-brand-300 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{clientsById[clientId]?.name ?? '—'}</p>
                          <p className="text-xs text-slate-500 truncate">{[...row.services].join(' · ')}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {row.visits} {row.visits === 1 ? 'cita' : 'citas'}
                          </p>
                          <p className="text-xs text-slate-500">Última: {formatShortDateInTimezone(row.last, timezone)}</p>
                        </div>
                      </div>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
