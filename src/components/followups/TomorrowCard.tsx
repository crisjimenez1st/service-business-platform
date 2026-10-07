import { MessageCircle, Phone, Check, CalendarClock } from 'lucide-react';
import { Badge, Button, Card } from '../ui';

interface TomorrowCardProps {
  clientName: string;
  phone: string;
  timeText: string;
  serviceType: string;
  sent: boolean;
  confirmed: boolean;
  onWhatsApp: () => void;
  onConfirmed: () => void;
  onReschedule: () => void;
}

/** Una cita de mañana: WhatsApp de un toque y, después, Confirmó / Reagendar. */
export default function TomorrowCard({
  clientName,
  phone,
  timeText,
  serviceType,
  sent,
  confirmed,
  onWhatsApp,
  onConfirmed,
  onReschedule,
}: TomorrowCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{clientName}</p>
          <p className="text-sm text-slate-600 mt-0.5">{serviceType}</p>
        </div>
        {confirmed ? <Badge tone="success">Confirmada</Badge> : <Badge tone="info">{timeText}</Badge>}
      </div>

      {confirmed ? (
        <p className="text-sm text-slate-500">Mañana a las {timeText}.</p>
      ) : !sent ? (
        <div className="flex gap-2">
          <Button variant="success" fullWidth icon={<MessageCircle size={18} />} onClick={onWhatsApp}>
            Confirmar por WhatsApp
          </Button>
          <a
            href={`tel:${phone}`}
            aria-label={`Llamar a ${clientName}`}
            className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Phone size={18} />
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">¿Qué respondió?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="success" icon={<Check size={16} />} onClick={onConfirmed}>
              Confirmó
            </Button>
            <Button size="sm" variant="secondary" icon={<CalendarClock size={16} />} onClick={onReschedule}>
              Reagendar
            </Button>
          </div>
          <button type="button" onClick={onWhatsApp} className="text-xs text-slate-500 hover:text-slate-700 underline min-h-8">
            Volver a enviar mensaje
          </button>
        </div>
      )}
    </Card>
  );
}
