import type { Job } from '../../types';
import { JOB_STATUS_TONES } from '../../utils/jobStatus';
import { formatTimeInTimezone } from '../../utils/timezone';

interface JobEventChipProps {
  job: Job;
  clientName: string | undefined;
  timezone: string;
  onClick: () => void;
  /** Compacto: solo hora + cliente truncado, para Month. Expandido: incluye servicio, para Week/Day. */
  variant?: 'compact' | 'expanded';
}

const TONE_DOT_CLASSES: Record<(typeof JOB_STATUS_TONES)[keyof typeof JOB_STATUS_TONES], string> = {
  neutral: 'bg-slate-400',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  danger: 'bg-red-500',
};

/**
 * Bloque pequeño y clickeable dentro de las grillas de calendario
 * (Month/Week/Day) -- nunca se usa en la agenda móvil, que usa
 * JobAgendaCard en su lugar (diseño distinto, pensado para tarjetas
 * completas, no chips compactos dentro de una grilla).
 */
export default function JobEventChip({ job, clientName, timezone, onClick, variant = 'compact' }: JobEventChipProps) {
  const tone = JOB_STATUS_TONES[job.status];
  const time = job.scheduledStartAt ? formatTimeInTimezone(job.scheduledStartAt, timezone) : '';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md px-1.5 py-1 bg-white border border-slate-200 hover:border-brand-300 hover:shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 min-h-0"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT_CLASSES[tone]}`} />
        {time && <span className="text-[11px] font-medium text-slate-500 shrink-0">{time}</span>}
        <span className="text-xs text-slate-800 truncate">{clientName ?? '—'}</span>
      </div>
      {variant === 'expanded' && (
        <p className="text-[11px] text-slate-500 truncate mt-0.5 ml-3">{job.serviceType}</p>
      )}
    </button>
  );
}
