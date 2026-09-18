import { Card, Badge } from '../ui';
import type { MockJob as Job } from '../../types';
import { formatDate } from '../../utils/dates';
import { formatCurrency } from '../../utils/currency';
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from '../../utils/jobStatus';

interface JobHistoryCardProps {
  job: Job;
}

export default function JobHistoryCard({ job }: JobHistoryCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium text-slate-900 truncate">{job.serviceType}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{formatDate(job.scheduledDate)}</p>
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
  );
}
