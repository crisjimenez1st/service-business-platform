import { MapPin, User } from 'lucide-react';
import type { Job, MyAssignedJob, JobStatus } from '../../types';
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from '../../utils/jobStatus';
import { Badge, Button } from '../ui';
import { formatTimeInTimezone } from '../../utils/timezone';
import { t } from '../../i18n/es';

const TONE_BAR_CLASSES: Record<(typeof JOB_STATUS_TONES)[keyof typeof JOB_STATUS_TONES], string> = {
  neutral: 'bg-slate-400',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  danger: 'bg-red-500',
};

interface AdminAgendaCardProps {
  mode: 'admin';
  job: Job;
  clientName: string | undefined;
  technicianName: string | undefined;
  timezone: string;
  onClick: () => void;
}

interface TechnicianAgendaCardProps {
  mode: 'technician';
  job: MyAssignedJob;
  timezone: string;
  onUpdateStatus: (newStatus: JobStatus) => void;
  actionPending?: boolean;
}

type JobAgendaCardProps = AdminAgendaCardProps | TechnicianAgendaCardProps;

/**
 * Tarjeta de agenda para la vista móvil (Fase 3, Bloque 4) -- diseño
 * nuevo, no una copia de TodayJobCard (que usa el Job mock de Fase 1
 * con scheduledTime string). Prioriza visualmente hora/cliente/
 * servicio/estado (fila superior), y muestra técnico/ubicación en una
 * fila secundaria compacta solo cuando aplica.
 *
 * Dos modos deliberadamente distintos en su propio tipo (no props
 * opcionales mezcladas): 'admin' recibe un Job completo y abre
 * JobDetailSheet al tocar la tarjeta; 'technician' recibe un
 * MyAssignedJob limitado y expone acciones de estado inline, sin
 * ningún sheet de detalle -- la tarjeta ya muestra todo lo que la RPC
 * le permite ver.
 */
export default function JobAgendaCard(props: JobAgendaCardProps) {
  const { timezone } = props;
  const tone = JOB_STATUS_TONES[props.job.status];
  const time = props.job.scheduledStartAt ? formatTimeInTimezone(props.job.scheduledStartAt, timezone) : null;

  const content = (
    <div className="flex gap-3">
      <div className={`w-1 rounded-full shrink-0 ${TONE_BAR_CLASSES[tone]}`} />
      <div className="flex-1 min-w-0 py-3 pr-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-base font-semibold text-slate-900">{time ?? t.calendar.unscheduled}</span>
          <Badge tone={tone}>{JOB_STATUS_LABELS[props.job.status]}</Badge>
        </div>
        <p className="text-sm font-medium text-slate-800 truncate">
          {props.mode === 'admin' ? (props.clientName ?? '—') : props.job.clientName}
        </p>
        <p className="text-xs text-slate-500 truncate">{props.job.serviceType}</p>

        {(props.mode === 'admin' ? props.technicianName : props.job.address) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            {props.mode === 'admin' && props.technicianName && (
              <span className="inline-flex items-center gap-1 truncate">
                <User size={12} className="shrink-0" />
                {props.technicianName}
              </span>
            )}
            {props.job.address && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin size={12} className="shrink-0" />
                {props.job.address}
              </span>
            )}
          </div>
        )}

        {props.mode === 'technician' && (
          <TechnicianActions job={props.job} onUpdateStatus={props.onUpdateStatus} pending={props.actionPending} />
        )}
      </div>
    </div>
  );

  if (props.mode === 'admin') {
    return (
      <button
        onClick={props.onClick}
        className="w-full text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-brand-300 hover:shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {content}
      </button>
    );
  }

  return <div className="w-full text-left bg-white border border-slate-200 rounded-2xl overflow-hidden">{content}</div>;
}

/**
 * Acciones de transición de estado, inline en la tarjeta -- pensadas
 * para uso en campo (móvil en mano, sin abrir un sheet aparte). La RPC
 * update_job_as_technician sigue siendo la única autoridad real: estos
 * botones solo ofrecen las transiciones que la tabla de estados del
 * Bloque 2 permite desde el estado actual, pero si la RPC rechazara
 * igual (ej. por una condición de carrera), el error se muestra tal
 * cual llega -- el frontend nunca asume que un botón visible implica
 * éxito garantizado.
 *
 * En in_progress se muestran las DOS transiciones válidas (Pausar y
 * Completar) simultáneamente, no una sola "siguiente acción" -- ambas
 * son igual de legítimas y el técnico decide cuál aplica.
 */
function TechnicianActions({
  job,
  onUpdateStatus,
  pending,
}: {
  job: MyAssignedJob;
  onUpdateStatus: (newStatus: JobStatus) => void;
  pending?: boolean;
}) {
  if (job.status === 'scheduled') {
    return (
      <div className="mt-3">
        <Button size="sm" fullWidth disabled={pending} onClick={() => onUpdateStatus('en_route')}>
          {t.calendar.startTravel}
        </Button>
      </div>
    );
  }

  if (job.status === 'en_route') {
    return (
      <div className="mt-3">
        <Button size="sm" fullWidth disabled={pending} onClick={() => onUpdateStatus('in_progress')}>
          {t.calendar.startJob}
        </Button>
      </div>
    );
  }

  if (job.status === 'in_progress') {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => onUpdateStatus('paused')}>
          {t.calendar.pauseJob}
        </Button>
        <Button size="sm" variant="success" disabled={pending} onClick={() => onUpdateStatus('completed')}>
          {t.calendar.completeJob}
        </Button>
      </div>
    );
  }

  if (job.status === 'paused') {
    return (
      <div className="mt-3">
        <Button size="sm" fullWidth disabled={pending} onClick={() => onUpdateStatus('in_progress')}>
          {t.calendar.resumeJob}
        </Button>
      </div>
    );
  }

  return null;
}
