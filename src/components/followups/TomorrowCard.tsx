import { MessageCircle, Phone, Check, CalendarClock, X, Users } from 'lucide-react';
import { Badge, Button, Card } from '../ui';

export type TomorrowStatus = 'pending' | 'reminded' | 'confirmed' | 'declined';

interface TomorrowCardProps {
  clientName: string;
  phone: string;
  timeText: string;
  serviceType: string;
  status: TomorrowStatus;
  /** Quién marcó la respuesta: el paciente desde su enlace o la clínica a mano. */
  source?: 'patient' | 'staff';
  busy: boolean;
  onWhatsApp: () => void;
  onConfirmed: () => void;
  onDeclined: () => void;
  onClear: () => void;
  onReschedule: () => void;
  onOfferSlot: () => void;
}

/**
 * Una cita de mañana. Es un RECORDATORIO: enviarlo es lo principal y
 * que el paciente no responda no es un problema. La respuesta (por el
 * enlace del paciente o marcada a mano) es un extra.
 */
export default function TomorrowCard({
  clientName,
  phone,
  timeText,
  serviceType,
  status,
  source,
  busy,
  onWhatsApp,
  onConfirmed,
  onDeclined,
  onClear,
  onReschedule,
  onOfferSlot,
}: TomorrowCardProps) {
  const badge =
    status === 'confirmed' ? (
      <Badge tone="success">Confirmó</Badge>
    ) : status === 'declined' ? (
      <Badge tone="warning">No podrá asistir</Badge>
    ) : status === 'reminded' ? (
      <Badge tone="info">Recordado</Badge>
    ) : (
      <Badge tone="neutral">{timeText}</Badge>
    );

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{clientName}</p>
          <p className="text-sm text-slate-600 mt-0.5">
            {serviceType} · {timeText}
          </p>
        </div>
        {badge}
      </div>

      {status === 'pending' && (
        <div className="flex gap-2">
          <Button variant="success" fullWidth icon={<MessageCircle size={18} />} onClick={onWhatsApp} disabled={busy}>
            Recordar por WhatsApp
          </Button>
          <a
            href={`tel:${phone}`}
            aria-label={`Llamar a ${clientName}`}
            className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Phone size={18} />
          </a>
        </div>
      )}

      {status === 'reminded' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            Recordatorio enviado. Si no responde, no pasa nada: puedes marcar lo que te diga.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="success" icon={<Check size={16} />} onClick={onConfirmed} disabled={busy}>
              Confirmó
            </Button>
            <Button size="sm" variant="secondary" icon={<X size={16} />} onClick={onDeclined} disabled={busy}>
              No podrá
            </Button>
          </div>
          <button type="button" onClick={onWhatsApp} className="text-xs text-slate-500 hover:text-slate-700 underline min-h-8">
            Volver a enviar recordatorio
          </button>
        </div>
      )}

      {status === 'confirmed' && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            {source === 'patient' ? 'Confirmó desde su enlace.' : 'Marcada como confirmada.'}
          </p>
          <button type="button" onClick={onClear} disabled={busy} className="text-xs text-slate-500 hover:text-slate-700 underline min-h-8">
            Corregir
          </button>
        </div>
      )}

      {status === 'declined' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {source === 'patient' ? 'Avisó desde su enlace que no podrá asistir.' : 'Marcada como "no podrá asistir".'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" icon={<CalendarClock size={16} />} onClick={onReschedule}>
              Reagendar
            </Button>
            <Button size="sm" variant="secondary" icon={<Users size={16} />} onClick={onOfferSlot}>
              Ofrecer a lista de espera
            </Button>
          </div>
          <button type="button" onClick={onClear} disabled={busy} className="text-xs text-slate-500 hover:text-slate-700 underline min-h-8">
            Corregir
          </button>
        </div>
      )}
    </Card>
  );
}
