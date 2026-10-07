import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { EmptyState, ErrorState } from '../components/ui';
import FollowupCard from '../components/followups/FollowupCard';
import WhatsAppFollowupSheet from '../components/followups/WhatsAppFollowupSheet';
import PostponeModal from '../components/opportunities/PostponeModal';
import DiscardModal from '../components/opportunities/DiscardModal';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useFollowupStore } from '../store/followupStore';
import { useTerms } from '../hooks/useTerms';
import { followupMessage } from '../i18n/businessTerms';
import { buildWhatsAppLink, toWhatsAppNumber } from '../utils/whatsapp';
import { addDaysToDateKey } from '../utils/followupDates';
import { getTodayKeyInTimezone } from '../utils/timezone';
import { t } from '../i18n/es';
import type { FollowupDue } from '../types';

/**
 * "A quién avisar hoy": la pantalla diaria del recordatorio. Un toque
 * abre WhatsApp con el mensaje listo (v1: sin API automática); marcar
 * "enviado" es solo local -- el estado del servidor cambia únicamente
 * con el resultado (Agendó / Más tarde / No le interesa).
 */
export default function FollowupsPage() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';
  const terms = useTerms();

  const items = useFollowupStore((s) => s.items);
  const sentIds = useFollowupStore((s) => s.sentIds);
  const loading = useFollowupStore((s) => s.loading);
  const error = useFollowupStore((s) => s.error);
  const load = useFollowupStore((s) => s.load);
  const markSent = useFollowupStore((s) => s.markSent);
  const booked = useFollowupStore((s) => s.booked);
  const postpone = useFollowupStore((s) => s.postpone);
  const discard = useFollowupStore((s) => s.discard);

  const [whatsappFor, setWhatsappFor] = useState<FollowupDue | null>(null);
  const [postponeFor, setPostponeFor] = useState<FollowupDue | null>(null);
  const [discardFor, setDiscardFor] = useState<FollowupDue | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) load(companyId);
  }, [companyId, load]);

  function handleSend(item: FollowupDue, message: string) {
    const number = toWhatsAppNumber(item.clientWhatsapp || item.clientPhone, timezone);
    window.open(buildWhatsAppLink(number, message), '_blank', 'noopener,noreferrer');
    markSent(item.opportunityId);
    setWhatsappFor(null);
  }

  async function run(item: FollowupDue, action: () => Promise<boolean>) {
    setBusyId(item.opportunityId);
    await action();
    setBusyId(null);
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{terms.followupsToday}</h1>
        {!loading && !error && items.length > 0 && (
          <p className="text-sm text-slate-500 mt-0.5">
            {items.length === 1 ? '1 persona para avisar' : `${items.length} personas para avisar`}
          </p>
        )}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => companyId && load(companyId)} />
      ) : loading && items.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellRing size={36} />}
          title="Hoy no hay a quién avisar"
          description={`Al registrar un ${terms.client.toLowerCase()} o terminar una cita, elige cuándo debe volver y aparecerá aquí ese día.`}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <FollowupCard
              key={item.opportunityId}
              item={item}
              sent={sentIds.includes(item.opportunityId)}
              busy={busyId === item.opportunityId}
              onWhatsApp={() => setWhatsappFor(item)}
              onBooked={() => run(item, () => booked(item.opportunityId))}
              onLater={() => setPostponeFor(item)}
              onNotInterested={() => setDiscardFor(item)}
            />
          ))}
        </div>
      )}

      {whatsappFor && (
        <WhatsAppFollowupSheet
          key={whatsappFor.opportunityId}
          open
          clientName={whatsappFor.clientName}
          initialMessage={followupMessage(company?.businessType, whatsappFor.clientName, company?.name ?? '')}
          onClose={() => setWhatsappFor(null)}
          onSend={(message) => handleSend(whatsappFor, message)}
        />
      )}

      {postponeFor && (
        <PostponeModal
          key={postponeFor.opportunityId}
          open
          currentDueDate={addDaysToDateKey(getTodayKeyInTimezone(timezone), 7)}
          onClose={() => setPostponeFor(null)}
          onConfirm={(date) => {
            const item = postponeFor;
            run(item, () => postpone(item.opportunityId, date));
          }}
        />
      )}

      {discardFor && (
        <DiscardModal
          open
          onClose={() => setDiscardFor(null)}
          onConfirm={() => {
            const item = discardFor;
            run(item, () => discard(item.opportunityId));
          }}
        />
      )}
    </div>
  );
}
