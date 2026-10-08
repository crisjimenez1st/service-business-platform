import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarCheck, ChevronLeft, ChevronRight, UserPlus, UserRoundCheck, Wallet } from 'lucide-react';
import { Card, EmptyState, ErrorState } from '../components/ui';
import MetricCard from '../components/dashboard/MetricCard';
import ComingSoonPage from './ComingSoonPage';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientsById } from '../hooks/useClientsById';
import * as jobService from '../services/jobService';
import { getIncomeInRange, type MonthIncome } from '../services/reportService';
import type { ServiceError } from '../services/errors/serviceError';
import { addMonthsToDateKey } from '../utils/followupDates';
import { formatCurrency } from '../utils/currency';
import { getDayKeyInTimezone, getTodayKeyInTimezone, localDateTimeToTimezoneIso } from '../utils/timezone';
import type { CurrencyCode, Job } from '../types';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const label = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1).replace(' de ', ' ');
}

interface MonthData {
  jobs: Job[];
  income: MonthIncome;
}

/** Fecha del día (YYYY-MM-DD) -> 0 = lunes ... 6 = domingo, sin depender de la zona horaria del navegador. */
function weekdayIndex(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function pctChange(now: number, before: number): string | null {
  if (before <= 0) return null;
  const p = Math.round(((now - before) / before) * 100);
  return `${p > 0 ? '+' : ''}${p}% vs mes anterior`;
}

/**
 * Reportes de la clínica: cómo va el mes (atención, asistencia, pacientes e
 * ingresos), comparado con el mes anterior. Solo dueño y recepción.
 */
export default function ReportsPage() {
  const { company } = useCurrentCompany();
  const { clients } = useClientsById();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';
  const canView = company?.role === 'owner' || company?.role === 'office';
  const isClinic = company?.businessType !== 'technical_services';

  const [monthKey, setMonthKey] = useState(() => getTodayKeyInTimezone(timezone).slice(0, 7) + '-01');
  const [current, setCurrent] = useState<MonthData | null>(null);
  const [previous, setPrevious] = useState<MonthData | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const bounds = (key: string) => ({
    start: localDateTimeToTimezoneIso(`${key}T00:00`, timezone),
    end: localDateTimeToTimezoneIso(`${addMonthsToDateKey(key, 1)}T00:00`, timezone),
  });
  const { start, end } = bounds(monthKey);

  useEffect(() => {
    if (!companyId || !canView || !isClinic) return;
    let cancelled = false;
    (async () => {
      const prevKey = addMonthsToDateKey(monthKey, -1);
      const loadMonth = async (key: string): Promise<MonthData | ServiceError> => {
        const b = {
          start: localDateTimeToTimezoneIso(`${key}T00:00`, timezone),
          end: localDateTimeToTimezoneIso(`${addMonthsToDateKey(key, 1)}T00:00`, timezone),
        };
        const [jobs, income] = await Promise.all([
          jobService.getJobsInRange(companyId, b.start, b.end),
          getIncomeInRange(companyId, b.start, b.end),
        ]);
        if (jobs.error) return jobs.error;
        if (income.error) return income.error;
        return { jobs: jobs.data, income: income.data };
      };
      const [cur, prev] = await Promise.all([loadMonth(monthKey), loadMonth(prevKey)]);
      if (cancelled) return;
      if ('message' in cur) return setError(cur);
      if ('message' in prev) return setError(prev);
      setError(null);
      setCurrent(cur);
      setPrevious(prev);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, canView, isClinic, monthKey, timezone, reloadKey]);

  const stats = useMemo(() => {
    const summarize = (jobs: Job[]) => {
      const dated = jobs.filter((j) => j.scheduledStartAt);
      const attended = dated.filter((j) => j.status === 'completed');
      const noShow = dated.filter((j) => j.status === 'cancelled' && j.cancellationCategory === 'no_show');
      const cancelled = dated.filter((j) => j.status === 'cancelled');
      const patients = new Set(attended.map((j) => j.clientId));
      const denominator = attended.length + noShow.length;
      return {
        attended,
        cancelled: cancelled.length,
        noShow: noShow.length,
        patients: patients.size,
        attendance: denominator > 0 ? Math.round((attended.length / denominator) * 100) : null,
        dated,
      };
    };
    return { now: summarize(current?.jobs ?? []), before: summarize(previous?.jobs ?? []) };
  }, [current, previous]);

  const topServices = useMemo(() => {
    const counts = new Map<string, number>();
    stats.now.attended.forEach((j) => counts.set(j.serviceType, (counts.get(j.serviceType) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [stats.now.attended]);

  const byWeekday = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0];
    stats.now.dated
      .filter((j) => j.status !== 'cancelled')
      .forEach((j) => {
        arr[weekdayIndex(getDayKeyInTimezone(j.scheduledStartAt ?? '', timezone))] += 1;
      });
    return arr;
  }, [stats.now.dated, timezone]);

  const newPatients = clients.filter((c) => c.createdAt >= start && c.createdAt < end).length;
  const prevBounds = bounds(addMonthsToDateKey(monthKey, -1));
  const prevNewPatients = clients.filter((c) => c.createdAt >= prevBounds.start && c.createdAt < prevBounds.end).length;

  if (!isClinic) return <ComingSoonPage title="Reportes" />;
  if (!canView) return <EmptyState icon={<BarChart3 size={32} />} title="Solo el dueño y la recepción pueden ver los reportes." />;

  const thisMonth = getTodayKeyInTimezone(timezone).slice(0, 7) + '-01';
  const currencies = (Object.keys(current?.income.byCurrency ?? {}) as CurrencyCode[]).length
    ? (Object.keys(current?.income.byCurrency ?? {}) as CurrencyCode[])
    : [((company?.currency ?? 'NIO') as CurrencyCode)];
  const maxService = Math.max(1, ...topServices.map(([, n]) => n));
  const maxDay = Math.max(1, ...byWeekday);

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Reportes</h1>
        <p className="text-sm text-slate-500 mt-0.5">Cómo va tu clínica, mes por mes.</p>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setMonthKey(addMonthsToDateKey(monthKey, -1))}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-xl text-slate-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ChevronLeft size={22} />
        </button>
        <p className="font-semibold text-slate-900">{monthLabel(monthKey)}</p>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={monthKey >= thisMonth}
          onClick={() => setMonthKey(addMonthsToDateKey(monthKey, 1))}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-xl text-slate-600 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : current === null || previous === null ? (
        <p className="text-center text-sm text-slate-500 py-10">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {currencies.map((c) => (
              <MetricCard
                key={c}
                label={currencies.length > 1 ? `Cobrado en el mes · ${c}` : 'Cobrado en el mes'}
                value={formatCurrency(current.income.byCurrency[c] ?? 0, c)}
                icon={<Wallet size={18} />}
                emphasis
              />
            ))}
            <MetricCard label="Citas atendidas" value={String(stats.now.attended.length)} icon={<CalendarCheck size={18} />} />
            <MetricCard label="Pacientes atendidos" value={String(stats.now.patients)} icon={<UserRoundCheck size={18} />} />
            <MetricCard label="Pacientes nuevos" value={String(newPatients)} icon={<UserPlus size={18} />} />
          </div>

          <Card className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">Asistencia</h2>
            <div className="flex items-end gap-3">
              <p className="text-4xl font-bold font-brand text-brand-700 tabular-nums">
                {stats.now.attendance === null ? '—' : `${stats.now.attendance}%`}
              </p>
              <p className="text-sm text-slate-500 pb-1.5">
                de los pacientes con cita llegaron
                {stats.before.attendance !== null && stats.now.attendance !== null
                  ? ` (mes anterior: ${stats.before.attendance}%)`
                  : ''}
              </p>
            </div>
            <p className="text-sm text-slate-600">
              {stats.now.noShow} {stats.now.noShow === 1 ? 'no llegó' : 'no llegaron'} · {stats.now.cancelled}{' '}
              {stats.now.cancelled === 1 ? 'cancelada' : 'canceladas'} en total
            </p>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Comparado con el mes anterior</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-slate-600">Citas atendidas</span>
                <span className="font-medium text-slate-900">
                  {stats.now.attended.length} <span className="text-slate-400 font-normal">antes {stats.before.attended.length}</span>
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-slate-600">Pacientes nuevos</span>
                <span className="font-medium text-slate-900">
                  {newPatients} <span className="text-slate-400 font-normal">antes {prevNewPatients}</span>
                </span>
              </li>
              {currencies.map((c) => {
                const now = current.income.byCurrency[c] ?? 0;
                const before = previous.income.byCurrency[c] ?? 0;
                const change = pctChange(now, before);
                return (
                  <li key={c} className="flex justify-between gap-3">
                    <span className="text-slate-600">Cobrado {currencies.length > 1 ? `(${c})` : ''}</span>
                    <span className="font-medium text-slate-900 text-right">
                      {formatCurrency(now, c)}{' '}
                      <span className="text-slate-400 font-normal">{change ?? `antes ${formatCurrency(before, c)}`}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Tratamientos más frecuentes</h2>
            {topServices.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no hay citas atendidas en este mes.</p>
            ) : (
              <ul className="space-y-2.5">
                {topServices.map(([name, n]) => (
                  <li key={name}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-slate-800 truncate">{name}</span>
                      <span className="font-semibold text-slate-900 tabular-nums">{n}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${(n / maxService) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Citas por día de la semana</h2>
            <div className="flex items-end justify-between gap-2 h-36">
              {byWeekday.map((n, i) => (
                <div key={WEEKDAYS[i]} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <span className="text-xs font-semibold text-slate-700 tabular-nums">{n}</span>
                  <div
                    className="w-full max-w-10 rounded-t-lg bg-brand-600/90"
                    style={{ height: `${Math.max(n > 0 ? 6 : 2, (n / maxDay) * 100)}%` }}
                  />
                  <span className="text-xs text-slate-500">{WEEKDAYS[i]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Sin contar las canceladas. Sirve para saber qué días vienen más pacientes.</p>
          </Card>
        </>
      )}
    </div>
  );
}
