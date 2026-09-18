import { Phone, MessageCircle } from 'lucide-react';
import { Sheet } from '../ui';
import type { Client } from '../../types';
import { buildWhatsAppLink } from '../../utils/whatsapp';

interface ContactSheetProps {
  open: boolean;
  onClose: () => void;
  client: Client | undefined;
  whatsappMessage: string;
  /** Se llama cuando el usuario elige una vía de contacto (llamar o WhatsApp),
   * antes de abrir el enlace — para marcar la oportunidad como "contactada". */
  onChooseChannel: () => void;
}

/**
 * Mismo componente para móvil y desktop: el Sheet ya se adapta
 * (bottom-sheet en móvil, modal centrado en desktop), así que no hace
 * falta una interfaz distinta por tamaño de pantalla — cumple el pedido
 * de no complicar la interfaz.
 */
export default function ContactSheet({
  open,
  onClose,
  client,
  whatsappMessage,
  onChooseChannel,
}: ContactSheetProps) {
  if (!client) return null;

  function handleChoice() {
    onChooseChannel();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Contactar a ${client.name}`}>
      <div className="space-y-2">
        <a
          href={`tel:${client.phone.replace(/\s/g, '')}`}
          onClick={handleChoice}
          className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 min-h-11 text-slate-700 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Phone size={20} className="text-brand-600 shrink-0" />
          <div>
            <p className="font-medium text-sm">Llamar</p>
            <p className="text-xs text-slate-500">{client.phone}</p>
          </div>
        </a>
        <a
          href={buildWhatsAppLink(client.whatsapp, whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleChoice}
          className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 min-h-11 text-slate-700 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <MessageCircle size={20} className="text-emerald-600 shrink-0" />
          <div>
            <p className="font-medium text-sm">WhatsApp</p>
            <p className="text-xs text-slate-500">Enviar mensaje prellenado</p>
          </div>
        </a>
      </div>
    </Sheet>
  );
}
