import { Button } from '../ui';
import type { Job } from '../../types';
import { t } from '../../i18n/es';

interface JobStatusActionsProps {
  job: Job;
  onAdvance: (newStatus: string) => void;
  onCancel: () => void;
  advancing?: boolean;
}

/**
 * Acciones administrativas de estado para owner/office -- llama
 * exclusivamente a advance_job_status (vía jobStore.advanceStatus) y
 * cancel_job (vía CancelJobModal). Deliberadamente NO es un selector
 * libre de estados: solo ofrece el/los siguiente(s) paso(s) válido(s)
 * según la misma tabla de transiciones que ya usa el técnico (ver
 * migración 011) -- saltar new->completed, por ejemplo, nunca es una
 * opción visible aquí, ni lo sería aunque se intentara vía otra ruta
 * (la RPC lo rechazaría igual).
 *
 * new/scheduled no ofrecen avance aquí -- new->scheduled es
 * exclusivo de schedule_job (ScheduleJobSheet), no de esta acción.
 */
export default function JobStatusActions({ job, onAdvance, onCancel, advancing }: JobStatusActionsProps) {
  const canCancel = ['new', 'scheduled', 'en_route', 'in_progress', 'paused'].includes(job.status);

  return (
    <div className="flex flex-wrap gap-2">
      {job.status === 'scheduled' && (
        <Button size="sm" disabled={advancing} onClick={() => onAdvance('en_route')}>
          {t.calendar.startTravel}
        </Button>
      )}
      {job.status === 'en_route' && (
        <Button size="sm" disabled={advancing} onClick={() => onAdvance('in_progress')}>
          {t.calendar.startJob}
        </Button>
      )}
      {job.status === 'in_progress' && (
        <>
          <Button size="sm" variant="secondary" disabled={advancing} onClick={() => onAdvance('paused')}>
            {t.calendar.pauseJob}
          </Button>
          <Button size="sm" variant="success" disabled={advancing} onClick={() => onAdvance('completed')}>
            {t.calendar.completeJob}
          </Button>
        </>
      )}
      {job.status === 'paused' && (
        <Button size="sm" disabled={advancing} onClick={() => onAdvance('in_progress')}>
          {t.calendar.resumeJob}
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="danger" disabled={advancing} onClick={onCancel}>
          {t.jobsPage.cancelJob}
        </Button>
      )}
    </div>
  );
}
