import type { Job, Client } from '../../types';
import JobEventChip from './JobEventChip';
import {
  getDayKeyInTimezone,
  getLocalHourInTimezone,
  expandHourRangeForJobs,
  formatShortDateInTimezone,
  startOfWeekMonday,
} from '../../utils/timezone';

interface WeekViewProps {
  /** Cualquier fecha dentro de la semana (lunes-domingo) a mostrar. */
  anchorDate: Date;
  jobs: Job[];
  clientsById: Record<string, Client>;
  timezone: string;
  onSelectJob: (jobId: string) => void;
}

export default function WeekView({ anchorDate, jobs, clientsById, timezone, onSelectJob }: WeekViewProps) {
  const weekStart = startOfWeekMonday(anchorDate);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  // El rango de horas base (7:00-20:00) se amplía si algún Job de la
  // semana cae fuera de esa franja -- nunca se oculta un Job válido
  // por quedar fuera del rango visual por defecto.
  const { startHour, endHour } = expandHourRangeForJobs(jobs, timezone);
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);

  const jobsByDayAndHour = new Map<string, Job[]>();
  for (const job of jobs) {
    if (!job.scheduledStartAt) continue;
    const dayKey = getDayKeyInTimezone(job.scheduledStartAt, timezone);
    const hour = getLocalHourInTimezone(job.scheduledStartAt, timezone);
    const key = `${dayKey}-${hour}`;
    const list = jobsByDayAndHour.get(key) ?? [];
    list.push(job);
    jobsByDayAndHour.set(key, list);
  }

  const todayKey = getDayKeyInTimezone(new Date().toISOString(), timezone);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-200">
          <div className="px-2 py-2" />
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10);
            const isToday = getDayKeyInTimezone(day.toISOString(), timezone) === todayKey;
            return (
              <div key={key} className="px-2 py-2 text-center">
                <p className="text-[11px] text-slate-500 uppercase">
                  {new Intl.DateTimeFormat('es-NI', { weekday: 'short' }).format(day)}
                </p>
                <p className={['text-sm font-semibold', isToday ? 'text-brand-600' : 'text-slate-800'].join(' ')}>
                  {formatShortDateInTimezone(day.toISOString(), timezone)}
                </p>
              </div>
            );
          })}
        </div>

        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-slate-100 last:border-b-0">
            <div className="px-2 py-2 text-[11px] text-slate-400 text-right">
              {hour}:00
            </div>
            {days.map((day) => {
              const dayKey = getDayKeyInTimezone(day.toISOString(), timezone);
              const cellJobs = jobsByDayAndHour.get(`${dayKey}-${hour}`) ?? [];
              return (
                <div key={dayKey + hour} className="px-1 py-1 border-l border-slate-100 min-h-12 flex flex-col gap-0.5">
                  {cellJobs.map((job) => (
                    <JobEventChip
                      key={job.id}
                      job={job}
                      clientName={clientsById[job.clientId]?.name}
                      timezone={timezone}
                      onClick={() => onSelectJob(job.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
