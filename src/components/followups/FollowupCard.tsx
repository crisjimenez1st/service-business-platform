import { MessageCircle, Phone, Check, Clock, X } from 'lucide-react';
import { Badge, Button, Card } from '../ui';
import type { FollowupDue } from '../../types';
import { formatCalendarDate } from '../../utils/timezone';

interface FollowupCardProps {
  item: FollowupDue;
  sent: boolean;
  busy: boolean;
  onWhatsApp: () => void;
  onBooked: () => void;
  onLater: () => void;
  onNotInterested: () => void;
}

function dueLabel(days: number): { text: string; tone: 'warning' | 'danger' | 'info' } {
  if (days <= 0) return { text: 'Hoy', tone: 'info' };
  if (days === 1) return { text: 'Desde ayer', tone: 'warning' };
  return { text: `Hace ${days} días`, tone: days > 14 ? 'danger' : 'warning' };
}

export default function FollowupCard({ item, sent, busy, onWhatsApp, onBooked, onLater, onNotInterested }: FollowupCardProps) {
  const due = dueLabel(item.daysOverdue);
  const phone = item.clientWhatsapp || item.clientPhone;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{item.clientName}</p>
          {item.reason && <p className="text-sm text-slate-600 mt-0.5">{item.reason}</p>}
          {item.lastVisitAt && (
            <p className="text-xs text-slate-500 mt-0.5">Última visita: {formatCalendarDate(item.lastVisitAt.slice(0, 10))}</p>
          )}
        </div>
        <Badge tone={due.tone}>{due.text}</Badge>
      </div>

      {!sent ? (
        <div className="flex gap-2">
          <Button variant="success" fullWidth icon={<MessageCircle size={18} />} onClick={onWhatsApp} disabled={busy}>
            Enviar por WhatsApp
          </Button>
          <a
            href={`tel:${phone}`}
            aria-label={`Llamar a ${item.clientName}`}
            className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Phone size={18} />
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">¿Qué respondió?</p>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="success" icon={<Check size={16} />} onClick={onBooked} disabled={busy}>
              Agendó
            </Button>
            <Button size="sm" variant="secondary" icon={<Clock size={16} />} onClick={onLater} disabled={busy}>
              Más tarde
            </Button>
            <Button size="sm" variant="danger" icon={<X size={16} />} onClick={onNotInterested} disabled={busy}>
              No le interesa
            </Button>
          </div>
          <button
            type="button"
            onClick={onWhatsApp}
            className="text-xs text-slate-500 hover:text-slate-700 underline min-h-8"
          >
            Volver a enviar mensaje
          </button>
        </div>
      )}
    </Card>
  );
}
