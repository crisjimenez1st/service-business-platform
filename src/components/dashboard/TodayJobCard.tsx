import { Phone, MessageCircle, MapPin, ArrowRight } from 'lucide-react';
import { Card, Badge, Button } from '../ui';
import type { MockJob as Job, Client } from '../../types';
import { t } from '../../i18n/es';
import { buildWhatsAppLink } from '../../utils/whatsapp';
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from '../../utils/jobStatus';

interface TodayJobCardProps {
  job: Job;
  client: Client | undefined;
  technicianName: string | undefined;
}

export default function TodayJobCard({ job, client, technicianName }: TodayJobCardProps) {
  if (!client) return null;

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-600">{job.scheduledTime}</p>
            <h3 className="font-semibold text-slate-900 truncate">{client.name}</h3>
            <p className="text-sm text-slate-500 truncate">{job.serviceType}</p>
          </div>
          <Badge tone={JOB_STATUS_TONES[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
        </div>

        {technicianName && (
          <p className="text-xs text-slate-500 mb-3">Técnico: {technicianName}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <Button variant="secondary" size="sm" icon={<ArrowRight size={16} />}>
            {t.dashboard.viewJob}
          </Button>
          <a
            href={`tel:${client.phone.replace(/\s/g, '')}`}
            className="inline-flex items-center justify-center gap-1.5 min-h-9 px-3 text-sm rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Phone size={16} />
            {t.dashboard.call}
          </a>
          <a
            href={buildWhatsAppLink(client.whatsapp, `Hola ${client.name}, te contactamos por tu cita de hoy.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 min-h-9 px-3 text-sm rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <MessageCircle size={16} />
            {t.dashboard.whatsapp}
          </a>
          {job.mapsUrl && (
            <a
              href={job.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 min-h-9 px-3 text-sm rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <MapPin size={16} />
              {t.dashboard.location}
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
