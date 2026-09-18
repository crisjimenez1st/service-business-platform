import { useNavigate } from 'react-router-dom';
import { Card, Badge } from '../ui';
import type { Job } from '../../types';
import { formatLongDateInTimezone, formatTimeInTimezone } from '../../utils/timezone';
import { formatCurrency } from '../../utils/currency';
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from '../../utils/jobStatus';

interface JobHistoryCardProps {
  job: Job;
  timezone: string;
}

/**
 * Tarjeta de historial de Jobs de un cliente (ClientProfilePage) --
 * migrada a datos reales de Supabase (Fase B2B, Bloque 5). Antes
 * usaba MockJob con scheduledDate string; ahora usa Job real con
 * scheduledStartAt timestamptz, presentado en la timezone de la
 * empresa (ver utils/timezone.ts).
 */
export default function JobHistoryCard({ job, timezone }: JobHistoryCardProps) {
  const navigate = useNavigate();

  return (
    <button className="w-full text-left" onClick={() => navigate(`/jobs/${job.id}`)}>
      <Card className="hover:border-brand-300 hover:shadow-sm transition-shadow">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-slate-900 truncate">{job.serviceType}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {job.scheduledStartAt
                ? `${formatLongDateInTimezone(job.scheduledStartAt, timezone)} · ${formatTimeInTimezone(job.scheduledStartAt, timezone)}`
                : 'Sin programar'}
            </p>
          </div>
          <Badge tone={JOB_STATUS_TONES[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
        </div>
        {job.total !== undefined && (
          <div className="flex gap-4 mt-2 pt-2 border-t border-slate-100 text-sm">
            <span className="text-slate-500">
              Total: <span className="text-slate-700 font-medium">{formatCurrency(job.total)}</span>
            </span>
            {job.paidAmount !== undefined && (
              <span className="text-slate-500">
                Pagado: <span className="text-slate-700 font-medium">{formatCurrency(job.paidAmount)}</span>
              </span>
            )}
          </div>
        )}
      </Card>
    </button>
  );
}
