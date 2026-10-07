import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Sheet, Button } from '../ui';

interface WhatsAppFollowupSheetProps {
  open: boolean;
  clientName: string;
  initialMessage: string;
  onClose: () => void;
  /** El usuario tocó "Abrir WhatsApp" con este mensaje (ya editado). */
  onSend: (message: string) => void;
}

/** Mensaje editable antes de abrir WhatsApp. Se monta solo para un seguimiento a la vez (key del caller), así que el texto siempre parte del mensaje de ese paciente. */
export default function WhatsAppFollowupSheet({
  open,
  clientName,
  initialMessage,
  onClose,
  onSend,
}: WhatsAppFollowupSheetProps) {
  const [message, setMessage] = useState(initialMessage);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Mensaje para ${clientName}`}
      footer={
        <Button
          fullWidth
          variant="success"
          icon={<MessageCircle size={18} />}
          disabled={!message.trim()}
          onClick={() => onSend(message.trim())}
        >
          Abrir WhatsApp
        </Button>
      }
    >
      <p className="text-sm text-slate-500 mb-3">Puedes editar el mensaje antes de enviarlo.</p>
      <textarea
        aria-label="Mensaje"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 resize-none"
      />
    </Sheet>
  );
}
