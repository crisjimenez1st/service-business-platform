import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Calendar as CalendarIcon } from 'lucide-react';
import { Sheet, Badge, Button } from '../ui';
import AssignTechnicianSheet from './AssignTechnicianSheet';
import ScheduleJobSheet from './ScheduleJobSheet';
import type { Job, Client, CompanyTechnician } from '../../types';
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from '../../utils/jobStatus';
import { formatTimeInTimezone, formatLongDateInTimezone } from '../../utils/timezone';
import { t } from '../../i18n/es';

interface JobDetailSheetProps {
  open: boolean;
  onClose: () => void;
  job: Job | undefined;
  client: Client | undefined;
  technicianName: string | undefined;
  technicians: CompanyTechnician[];
  timezone: string;
  onAssignTechnician: (technicianId: string | null) => Promise<boolean>;
  onSchedule: (startAtIso: string | null, endAtIso: string | null) => Promise<boolean>;
}

/**
 * Detalle administrativo de un Job -- solo owner/office (nunca se abre
 * para technician, ver CalendarPage). Orquesta AssignTechnicianSheet y
 * ScheduleJobSheet; en sí mismo no hace ninguna escritura, solo pasa
 * los callbacks del store hacia abajo.
 */
export default function JobDetailSheet({
  open,
  onClose,
  job,
  client,
  technicianName,
  technicians,
  timezone,
  onAssignTechnician,
  onSchedule,
}: JobDetailSheetProps) {
  const navigate = useNavigate();
  const [assignOpen, setAssignOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  if (!job) {
    return (
      <Sheet open={open} onClose={onClose} title="">
        {null}
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open && !assignOpen && !scheduleOpen} onClose={onClose} title={job.serviceType}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge tone={JOB_STATUS_TONES[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
            {job.scheduledStartAt && (
              <span className="text-sm text-slate-500">
                {formatLongDateInTimezone(job.scheduledStartAt, timezone)} ·{' '}
                {formatTimeInTimezone(job.scheduledStartAt, timezone)}
              </span>
            )}
          </div>

          <div>
            <p className="text-xs text-slate-500">{t.calendar.client}</p>
            <p className="text-sm font-medium text-slate-900">{client?.name ?? '—'}</p>
          </div>

          {job.description && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Descripción</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {job.notes && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Notas</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{job.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-500">{t.calendar.technician}</p>
            <p className="text-sm font-medium text-slate-900">{technicianName ?? t.calendar.unassigned}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setAssignOpen(true)}>
              {t.calendar.assignTechnician}
            </Button>
            <Button variant="secondary" icon={<CalendarIcon size={16} />} onClick={() => setScheduleOpen(true)}>
              {job.status === 'scheduled' ? t.calendar.reschedule : t.calendar.schedule}
            </Button>
          </div>

          {client && (
            <Button variant="ghost" fullWidth onClick={() => navigate(`/clients/${client.id}`)}>
              {t.calendar.viewClientProfile}
            </Button>
          )}
        </div>
      </Sheet>

      <AssignTechnicianSheet
        key={`${job.id}-${assignOpen}`}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        technicians={technicians}
        currentTechnicianId={job.assignedTechnicianId}
        onAssign={onAssignTechnician}
      />

      <ScheduleJobSheet
        key={`${job.id}-${scheduleOpen}`}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        timezone={timezone}
        currentStartAt={job.scheduledStartAt}
        currentEndAt={job.scheduledEndAt}
        isCurrentlyScheduled={job.status === 'scheduled'}
        onSchedule={onSchedule}
      />
    </>
  );
}
