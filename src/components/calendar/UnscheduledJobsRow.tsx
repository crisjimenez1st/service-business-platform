import type { Job, Client } from '../../types';
import { Card } from '../ui';
import JobEventChip from './JobEventChip';
import { t } from '../../i18n/es';

interface UnscheduledJobsRowProps {
  jobs: Job[];
  clientsById: Record<string, Client>;
  timezone: string;
  onSelectJob: (jobId: string) => void;
}

/**
 * Jobs sin scheduled_start_at (status='new', recién convertidos desde
 * un JobDraft) -- se muestran siempre, fuera de la grilla de fechas,
 * para que nunca desaparezcan silenciosamente por no tener dónde
 * posicionarse en Month/Week/Day.
 */
export default function UnscheduledJobsRow({ jobs, clientsById, timezone, onSelectJob }: UnscheduledJobsRowProps) {
  if (jobs.length === 0) return null;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        {t.calendar.unscheduled} ({jobs.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {jobs.map((job) => (
          <div key={job.id} className="w-48">
            <JobEventChip
              job={job}
              clientName={clientsById[job.clientId]?.name}
              timezone={timezone}
              onClick={() => onSelectJob(job.id)}
              variant="expanded"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
