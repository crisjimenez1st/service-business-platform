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

const TONE_CLASSES: Record<(typeof JOB_STATUS_TONES)[keyof typeof JOB_STATUS_TONES], string> = {
  neutral: 'bg-slate-100 border-l-slate-400 text-slate-800 hover:bg-slate-200/70',
  info: 'bg-sky-50 border-l-sky-500 text-sky-950 hover:bg-sky-100',
  warning: 'bg-amber-50 border-l-amber-500 text-amber-950 hover:bg-amber-100',
  success: 'bg-emerald-50 border-l-emerald-500 text-emerald-950 hover:bg-emerald-100',
  danger: 'bg-red-50 border-l-red-500 text-red-950 hover:bg-red-100',
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
      className={`w-full text-left rounded-lg border-l-4 px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 min-h-0 ${TONE_CLASSES[tone]}`}
    >
      <div className="flex items-baseline gap-2 min-w-0">
        {time && <span className="text-xs sm:text-sm font-semibold shrink-0 tabular-nums">{time}</span>}
        <span className="text-sm truncate font-medium">{clientName ?? '—'}</span>
      </div>
      {variant === 'expanded' && (
        <p className="text-xs sm:text-sm opacity-75 truncate mt-0.5">{job.serviceType}</p>
      )}
    </button>
  );
}
