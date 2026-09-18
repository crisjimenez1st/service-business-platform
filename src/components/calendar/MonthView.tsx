import type { Job, Client } from '../../types';
import JobEventChip from './JobEventChip';
import { getDayKeyInTimezone, startOfWeekMonday } from '../../utils/timezone';
import { t } from '../../i18n/es';

interface MonthViewProps {
  /** Cualquier fecha dentro del mes a mostrar. */
  anchorDate: Date;
  jobs: Job[];
  clientsById: Record<string, Client>;
  timezone: string;
  onSelectJob: (jobId: string) => void;
  onSelectDay: (date: Date) => void;
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_CHIPS_PER_DAY = 3;

export default function MonthView({ anchorDate, jobs, clientsById, timezone, onSelectJob, onSelectDay }: MonthViewProps) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const lastOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const gridStart = startOfWeekMonday(firstOfMonth);
  const gridEnd = startOfWeekMonday(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + 6);

  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const jobsByDayKey = new Map<string, Job[]>();
  for (const job of jobs) {
    if (!job.scheduledStartAt) continue;
    const key = getDayKeyInTimezone(job.scheduledStartAt, timezone);
    const list = jobsByDayKey.get(key) ?? [];
    list.push(job);
    jobsByDayKey.set(key, list);
  }

  const todayKey = getDayKeyInTimezone(new Date().toISOString(), timezone);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-2 text-xs font-semibold text-slate-500 text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const dayJobs = jobsByDayKey.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
          const isToday = key === todayKey;
          const visibleJobs = dayJobs.slice(0, MAX_CHIPS_PER_DAY);
          const extraCount = dayJobs.length - visibleJobs.length;

          return (
            <button
              key={key}
              onClick={() => onSelectDay(day)}
              className={[
                'min-h-24 sm:min-h-28 border-b border-r border-slate-100 p-1.5 text-left flex flex-col gap-1',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                isCurrentMonth ? 'bg-white' : 'bg-slate-50',
              ].join(' ')}
            >
              <span
                className={[
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full shrink-0',
                  isToday ? 'bg-brand-600 text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400',
                ].join(' ')}
              >
                {day.getDate()}
              </span>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                {visibleJobs.map((job) => (
                  <div key={job.id} onClick={(e) => e.stopPropagation()}>
                    <JobEventChip
                      job={job}
                      clientName={clientsById[job.clientId]?.name}
                      timezone={timezone}
                      onClick={() => onSelectJob(job.id)}
                    />
                  </div>
                ))}
                {extraCount > 0 && (
                  <span className="text-[11px] text-brand-600 font-medium pl-1">
                    +{extraCount} {t.calendar.moreJobs}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
