import { MessageCircle, Phone, Check, X } from 'lucide-react';
import { Badge, Button, Card } from '../ui';
import { formatCalendarDate } from '../../utils/timezone';

interface WaitlistCardProps {
  name: string;
  phone: string;
  note: string;
  service: string;
  createdAt: string;
  sent: boolean;
  busy: boolean;
  onWhatsApp: () => void;
  onBooked: () => void;
  onRemove: () => void;
}

/** Una persona de la lista de espera: WhatsApp de un toque; luego Agendó o Quitar. */
export default function WaitlistCard({ name, phone, note, service, createdAt, sent, busy, onWhatsApp, onBooked, onRemove }: WaitlistCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{name}</p>
          {service && <p className="text-sm text-slate-600 mt-0.5">{service}</p>}
          {note && <p className="text-sm text-slate-500 mt-0.5">{note}</p>}
        </div>
        <Badge tone="neutral">Desde {formatCalendarDate(createdAt.slice(0, 10))}</Badge>
      </div>

      {!sent ? (
        <div className="flex gap-2">
          <Button variant="success" fullWidth icon={<MessageCircle size={18} />} onClick={onWhatsApp} disabled={busy}>
            Avisar por WhatsApp
          </Button>
          <a
            href={`tel:${phone}`}
            aria-label={`Llamar a ${name}`}
            className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Phone size={18} />
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">¿Qué respondió?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="success" icon={<Check size={16} />} onClick={onBooked} disabled={busy}>
              Agendó
            </Button>
            <Button size="sm" variant="secondary" icon={<X size={16} />} onClick={onRemove} disabled={busy}>
              Quitar de la lista
            </Button>
          </div>
          <button type="button" onClick={onWhatsApp} className="text-xs text-slate-500 hover:text-slate-700 underline min-h-8">
            Volver a enviar mensaje
          </button>
        </div>
      )}
      {sent && <p className="sr-only">Mensaje enviado</p>}
    </Card>
  );
}
