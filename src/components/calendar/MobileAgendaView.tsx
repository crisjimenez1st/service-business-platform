import type { Job, MyAssignedJob, Client, JobStatus } from '../../types';
import JobAgendaCard from './JobAgendaCard';
import { EmptyState } from '../ui';
import { getDayKeyInTimezone, formatLongDateInTimezone } from '../../utils/timezone';
import { t } from '../../i18n/es';

interface AdminMobileAgendaProps {
  mode: 'admin';
  jobs: Job[];
  clientsById: Record<string, Client>;
  technicianNamesById: Record<string, string>;
  timezone: string;
  onSelectJob: (jobId: string) => void;
}

interface TechnicianMobileAgendaProps {
  mode: 'technician';
  jobs: MyAssignedJob[];
  timezone: string;
  onUpdateStatus: (jobId: string, newStatus: JobStatus) => void;
  pendingJobId?: string | null;
}

type MobileAgendaViewProps = AdminMobileAgendaProps | TechnicianMobileAgendaProps;

/**
 * Agenda de tarjetas, agrupada por día -- usada siempre para technician
 * (nunca ve la grilla Month/Week/Day administrativa), y en viewport
 * móvil para owner/office. Los Jobs ya vienen pre-filtrados al rango
 * que el caller decidió mostrar (día/semana/mes según CalendarPage) --
 * este componente solo agrupa y presenta, no decide qué rango cargar.
 */
export default function MobileAgendaView(props: MobileAgendaViewProps) {
  const { timezone } = props;
  const jobs: (Job | MyAssignedJob)[] = props.jobs;

  const scheduled = jobs.filter((j) => j.scheduledStartAt);
  const unscheduled = jobs.filter((j) => !j.scheduledStartAt);

  const groups = new Map<string, (Job | MyAssignedJob)[]>();
  for (const job of scheduled) {
    const key = getDayKeyInTimezone(job.scheduledStartAt as string, timezone);
    const list = groups.get(key) ?? [];
    list.push(job);
    groups.set(key, list);
  }
  const sortedDayKeys = [...groups.keys()].sort();

  if (jobs.length === 0) {
    return <EmptyState title={t.calendar.noJobsThisRange} />;
  }

  return (
    <div className="space-y-6">
      {sortedDayKeys.map((dayKey) => {
        const dayJobs = groups.get(dayKey)!;
        const label = formatLongDateInTimezone(dayJobs[0].scheduledStartAt as string, timezone);
        return (
          <div key={dayKey}>
            <h3 className="text-sm font-semibold text-slate-700 capitalize mb-2">{label}</h3>
            <div className="space-y-2">
              {dayJobs.map((job) =>
                props.mode === 'admin' ? (
                  <JobAgendaCard
                    key={job.id}
                    mode="admin"
                    job={job as Job}
                    clientName={props.clientsById[(job as Job).clientId]?.name}
                    technicianName={
                      (job as Job).assignedTechnicianId
                        ? props.technicianNamesById[(job as Job).assignedTechnicianId as string]
                        : undefined
                    }
                    timezone={timezone}
                    onClick={() => props.onSelectJob(job.id)}
                  />
                ) : (
                  <JobAgendaCard
                    key={job.id}
                    mode="technician"
                    job={job as MyAssignedJob}
                    timezone={timezone}
                    onUpdateStatus={(newStatus) => props.onUpdateStatus(job.id, newStatus)}
                    actionPending={props.pendingJobId === job.id}
                  />
                )
              )}
            </div>
          </div>
        );
      })}

      {unscheduled.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            {t.calendar.unscheduled} ({unscheduled.length})
          </h3>
          <div className="space-y-2">
            {unscheduled.map((job) =>
              props.mode === 'admin' ? (
                <JobAgendaCard
                  key={job.id}
                  mode="admin"
                  job={job as Job}
                  clientName={props.clientsById[(job as Job).clientId]?.name}
                  technicianName={
                    (job as Job).assignedTechnicianId
                      ? props.technicianNamesById[(job as Job).assignedTechnicianId as string]
                      : undefined
                  }
                  timezone={timezone}
                  onClick={() => props.onSelectJob(job.id)}
                />
              ) : (
                <JobAgendaCard
                  key={job.id}
                  mode="technician"
                  job={job as MyAssignedJob}
                  timezone={timezone}
                  onUpdateStatus={(newStatus) => props.onUpdateStatus(job.id, newStatus)}
                  actionPending={props.pendingJobId === job.id}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
