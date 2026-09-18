import type { Job, Client } from '../../types';
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from '../../utils/jobStatus';
import { Badge } from '../ui';
import { getLocalHourInTimezone, expandHourRangeForJobs, formatTimeInTimezone } from '../../utils/timezone';
import { t } from '../../i18n/es';

interface DayViewProps {
  jobs: Job[];
  clientsById: Record<string, Client>;
  timezone: string;
  onSelectJob: (jobId: string) => void;
}

export default function DayView({ jobs, clientsById, timezone, onSelectJob }: DayViewProps) {
  const { startHour, endHour } = expandHourRangeForJobs(jobs, timezone);
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);

  const jobsByHour = new Map<number, Job[]>();
  for (const job of jobs) {
    if (!job.scheduledStartAt) continue;
    const hour = getLocalHourInTimezone(job.scheduledStartAt, timezone);
    const list = jobsByHour.get(hour) ?? [];
    list.push(job);
    jobsByHour.set(hour, list);
  }

  if (jobs.filter((j) => j.scheduledStartAt).length === 0) {
    return <p className="text-center text-sm text-slate-500 py-12">{t.calendar.noJobsToday}</p>;
  }

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {hours.map((hour) => {
        const hourJobs = jobsByHour.get(hour) ?? [];
        return (
          <div key={hour} className="flex border-b border-slate-100 last:border-b-0">
            <div className="w-14 shrink-0 px-2 py-3 text-xs text-slate-400 text-right">{hour}:00</div>
            <div className="flex-1 border-l border-slate-100 p-2 space-y-2 min-h-14">
              {hourJobs.map((job) => {
                const client = clientsById[job.clientId];
                return (
                  <button
                    key={job.id}
                    onClick={() => onSelectJob(job.id)}
                    className="w-full text-left rounded-xl border border-slate-200 p-3 hover:border-brand-300 hover:shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{client?.name ?? '—'}</p>
                        <p className="text-xs text-slate-500 truncate">{job.serviceType}</p>
                        {job.scheduledStartAt && (
                          <p className="text-xs text-brand-600 font-medium mt-1">
                            {formatTimeInTimezone(job.scheduledStartAt, timezone)}
                            {job.scheduledEndAt && ` – ${formatTimeInTimezone(job.scheduledEndAt, timezone)}`}
                          </p>
                        )}
                      </div>
                      <Badge tone={JOB_STATUS_TONES[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
