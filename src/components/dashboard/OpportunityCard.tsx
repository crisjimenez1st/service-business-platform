import { MessageCircle, Clock3, FileText } from 'lucide-react';
import { Card, Button, Badge } from '../ui';
import type { Opportunity, Client } from '../../types';
import { t } from '../../i18n/es';
import { formatCurrency } from '../../utils/currency';
import { opportunityWhatsAppMessage, buildWhatsAppLink } from '../../utils/whatsapp';
import { formatRelativeToToday } from '../../utils/dates';

interface OpportunityCardProps {
  opportunity: Opportunity;
  client: Client | undefined;
  onPostpone: (id: string) => void;
  onDiscard: (id: string) => void;
  onContact: (id: string) => void;
  onCreateQuote: (id: string) => void;
  onSendOffer: (id: string) => void;
  /** true mientras create_quote_from_opportunity está en curso para ESTA oportunidad -- deshabilita el botón para evitar doble-click (la protección real contra duplicados es la propia RPC, esto es solo la primera línea de defensa en UI). */
  creatingQuote?: boolean;
  compact?: boolean;
}

/**
 * La tarjeta más importante de toda la aplicación: debe transmitir
 * "esto es dinero que estás por perder si no actúas".
 * Usa borde y acento de marca (no un color de alarma genérico) para
 * mantener el tono profesional sin saturar la UI de rojos/amarillos.
 *
 * Cuando `status === 'contacted'` la tarjeta sigue visible (no
 * desaparece como al descartar/convertir) pero muestra una insignia
 * "Contactado" para dejar claro que ya hubo seguimiento.
 */
export default function OpportunityCard({
  opportunity,
  client,
  onPostpone,
  onDiscard,
  onContact,
  onCreateQuote,
  onSendOffer,
  creatingQuote,
  compact,
}: OpportunityCardProps) {
  if (!client) return null;

  const whatsappMsg = opportunityWhatsAppMessage(
    client.name,
    opportunity.title,
    formatCurrency(opportunity.estimatedValue)
  );
  const wasContacted = opportunity.status === 'contacted';

  return (
    <Card className="border-l-4 border-l-brand-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">{client.name}</h3>
            {wasContacted && <Badge tone="info">Contactado</Badge>}
          </div>
          <p className="text-sm text-slate-600 mt-0.5">{opportunity.title}</p>
          {!compact && <p className="text-xs text-slate-500 mt-1">{opportunity.reason}</p>}
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
            <Clock3 size={13} />
            <span>{formatRelativeToToday(opportunity.dueDate)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg sm:text-xl font-semibold text-brand-700">
            {formatCurrency(opportunity.estimatedValue)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <a
          href={buildWhatsAppLink(client.whatsapp, whatsappMsg)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onSendOffer(opportunity.id)}
          className="col-span-2 inline-flex items-center justify-center gap-1.5 min-h-9 px-3 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <MessageCircle size={16} />
          {t.dashboard.sendOffer}
        </a>
        <Button variant="secondary" size="sm" onClick={() => onContact(opportunity.id)}>
          {t.dashboard.contact}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<FileText size={16} />}
          disabled={creatingQuote}
          onClick={() => onCreateQuote(opportunity.id)}
        >
          {creatingQuote ? t.common.loading : t.opportunities.createQuote}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onPostpone(opportunity.id)}>
          {t.dashboard.postpone}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDiscard(opportunity.id)}>
          {t.dashboard.discard}
        </Button>
      </div>
    </Card>
  );
}
