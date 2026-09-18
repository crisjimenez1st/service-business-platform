import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, MessageCircle } from 'lucide-react';
import { Button, EmptyState, ErrorState, Sheet } from '../components/ui';
import {
  getPublicQuoteByToken,
  markViewedByToken,
  acceptQuoteByToken,
  rejectQuoteByToken,
} from '../services/quoteService';
import type { ServiceError } from '../services/errors/serviceError';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { buildWhatsAppLink } from '../utils/whatsapp';
import type { PublicQuoteView, RejectionReason } from '../types';
import { t } from '../i18n/es';

const REJECTION_OPTIONS: { value: RejectionReason; label: string }[] = [
  { value: 'price', label: t.quotePublic.rejectReasonPrice },
  { value: 'chose_another_provider', label: t.quotePublic.rejectReasonOtherProvider },
  { value: 'not_needed_now', label: t.quotePublic.rejectReasonNotNeeded },
  { value: 'wants_changes', label: t.quotePublic.rejectReasonWantsChanges },
  { value: 'other', label: t.quotePublic.rejectReasonOther },
];

/**
 * Página pública de cotización — SIN sidebar, SIN navegación
 * administrativa, SIN sesión, SIN CompanyProvider, SIN companyId.
 * Único punto de acceso: publicToken en la URL. Depende exclusivamente
 * de PublicQuoteView + las RPC públicas (get_public_quote_by_token,
 * mark_public_quote_viewed, accept_public_quote, reject_public_quote)
 * -- nunca consulta `clients`/`companies` por su cuenta ni carga ningún
 * id interno (Quote.id, companyId, clientId no existen en este tipo).
 *
 * La UI no es autoridad: cada acción llama a la RPC correspondiente y
 * SIEMPRE vuelve a pedir el estado real (getPublicQuoteByToken) después
 * -- si la RPC rechazó la transición (venció, ya respondida, etc.), la
 * recarga refleja el estado verdadero en vez de asumir éxito.
 */
export default function QuotePublicPage() {
  const { publicToken } = useParams<{ publicToken: string }>();

  const [view, setView] = useState<PublicQuoteView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);

  const [acceptSheetOpen, setAcceptSheetOpen] = useState(false);
  const [rejectSheetOpen, setRejectSheetOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<RejectionReason | undefined>(undefined);
  const [actionPending, setActionPending] = useState(false);

  const loadView = useCallback(async () => {
    if (!publicToken) return;
    setLoading(true);
    setError(null);
    const result = await getPublicQuoteByToken(publicToken);
    if (result.error) {
      setView(null);
      setError(result.error);
    } else {
      setView(result.data);
    }
    setLoading(false);
  }, [publicToken]);

  // Al montar: marca "viewed" (si corresponde -- la RPC solo transiciona
  // sent -> viewed, cualquier otro estado base no se toca) y luego
  // carga la vista real. Efecto legítimo de "el cliente abrió el
  // enlace", distinto de un fetch de sincronización de estado
  // derivado -- por eso corre en useEffect, no en un lazy initializer:
  // aquí SÍ queremos loading/error explícitos desde el primer render.
  useEffect(() => {
    if (!publicToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await markViewedByToken(publicToken);
      if (cancelled) return;
      await loadView();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicToken]);

  async function handleAccept() {
    if (!publicToken) return;
    setActionPending(true);
    await acceptQuoteByToken(publicToken);
    // No se ramifica sobre el resultado de acceptQuoteByToken: la UI
    // no es autoridad -- siempre se recarga el estado real después,
    // sea cual sea el resultado de la RPC (éxito, rechazo por venció,
    // rechazo por ya respondida, etc.).
    await loadView();
    setActionPending(false);
    setAcceptSheetOpen(false);
  }

  async function handleReject() {
    if (!publicToken) return;
    setActionPending(true);
    await rejectQuoteByToken(publicToken, selectedReason);
    await loadView();
    setActionPending(false);
    setRejectSheetOpen(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <p className="text-sm text-slate-500">{t.common.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <ErrorState message={error.message} onRetry={loadView} />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <EmptyState title={t.quotePublic.notFound} />
      </div>
    );
  }

  const isExpired = view.effectiveStatus === 'expired';
  /**
   * Misma regla que el servicio/RPC (PUBLIC_RESPONSE_ALLOWED_STATUSES
   * en quoteService, sent/viewed en accept_public_quote/reject_public_quote):
   * lista de inclusión explícita, nunca una negación que pudiera dejar
   * pasar por accidente draft/cancelled.
   */
  const canRespond = view.effectiveStatus === 'sent' || view.effectiveStatus === 'viewed';
  const notAvailableForResponse = view.effectiveStatus === 'draft' || view.effectiveStatus === 'cancelled';

  if (view.effectiveStatus === 'accepted') {
    return (
      <ResponseScreen
        variant="accepted"
        title={t.quotePublic.acceptedTitle}
        message={t.quotePublic.acceptedMessage}
        companyName={view.companyName}
      />
    );
  }

  if (view.effectiveStatus === 'rejected') {
    return (
      <ResponseScreen
        variant="rejected"
        title={t.quotePublic.rejectedTitle}
        message={t.quotePublic.rejectedMessage}
        companyName={view.companyName}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:py-10">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Encabezado tipo documento */}
        <div className="bg-brand-600 text-white px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center gap-3 mb-4">
            {view.companyLogoUrl ? (
              <img
                src={view.companyLogoUrl}
                alt={view.companyName}
                className="w-10 h-10 rounded-lg object-cover bg-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
                <Shield size={20} />
              </div>
            )}
            <span className="font-semibold text-lg">{view.companyName}</span>
          </div>
          <p className="text-brand-100 text-sm">{t.quotePublic.quoteNumber}</p>
          <p className="text-2xl font-semibold">{view.quoteNumber}</p>
        </div>

        {isExpired && (
          <div className="bg-amber-50 text-amber-800 text-sm px-6 py-3 text-center font-medium">
            {t.quotePublic.expiredBanner}
          </div>
        )}

        <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
          {/* Metadatos */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">{t.quotePublic.client}</p>
              <p className="font-medium text-slate-900">{view.clientName}</p>
            </div>
            <div>
              <p className="text-slate-500">{t.quotePublic.issueDate}</p>
              <p className="font-medium text-slate-900">{formatDate(view.issueDate)}</p>
            </div>
            <div>
              <p className="text-slate-500">{t.quotePublic.validUntil}</p>
              <p className="font-medium text-slate-900">{formatDate(view.expirationDate)}</p>
            </div>
          </div>

          {/* Items */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            {view.items.map((item, index) => (
              <div key={index} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-slate-900">{item.description}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <span className="font-medium text-slate-900 shrink-0">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">{t.quotePublic.subtotal}</span>
              <span className="text-slate-900">{formatCurrency(view.subtotal)}</span>
            </div>
            {view.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">{t.quotes.discount}</span>
                <span className="text-slate-900">− {formatCurrency(view.discount)}</span>
              </div>
            )}
            {view.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">{t.quotes.tax}</span>
                <span className="text-slate-900">{formatCurrency(view.tax)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="font-semibold text-slate-900">{t.quotePublic.total}</span>
              <span className="text-2xl font-bold text-brand-700">{formatCurrency(view.total)}</span>
            </div>
          </div>

          {view.notes && (
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs font-medium text-slate-500 mb-1">{t.quotePublic.notes}</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{view.notes}</p>
            </div>
          )}

          {/* Acciones — solo si el estado efectivo es sent/viewed */}
          {canRespond && (
            <div className="space-y-2 pt-2">
              <Button fullWidth size="lg" variant="success" onClick={() => setAcceptSheetOpen(true)}>
                {t.quotePublic.accept}
              </Button>
              <Button fullWidth size="lg" variant="secondary" onClick={() => setRejectSheetOpen(true)}>
                {t.quotePublic.reject}
              </Button>
            </div>
          )}

          {notAvailableForResponse && (
            <p className="text-sm text-slate-500 text-center pt-2">
              {t.quotePublic.notAvailableForResponse}
            </p>
          )}

          {isExpired && view.companyPhone && (
            <a
              href={buildWhatsAppLink(
                view.companyPhone,
                `Hola, mi cotización ${view.quoteNumber} venció. ¿Podrían actualizarla?`
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button fullWidth size="lg" icon={<MessageCircle size={18} />}>
                {t.dashboard.whatsapp}
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Confirmación de aceptación */}
      <Sheet
        open={acceptSheetOpen}
        onClose={() => setAcceptSheetOpen(false)}
        title={t.quotePublic.acceptConfirmTitle}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth disabled={actionPending} onClick={() => setAcceptSheetOpen(false)}>
              {t.quotePublic.cancel}
            </Button>
            <Button variant="success" fullWidth disabled={actionPending} onClick={handleAccept}>
              {t.quotePublic.confirm}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          {t.quotePublic.client}: {view.clientName} — {t.quotePublic.total}: {formatCurrency(view.total)}
        </p>
      </Sheet>

      {/* Motivo de rechazo (opcional) */}
      <Sheet
        open={rejectSheetOpen}
        onClose={() => setRejectSheetOpen(false)}
        title={t.quotePublic.rejectTitle}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth disabled={actionPending} onClick={() => setRejectSheetOpen(false)}>
              {t.quotePublic.cancel}
            </Button>
            <Button variant="danger" fullWidth disabled={actionPending} onClick={handleReject}>
              {t.quotePublic.confirm}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-500 mb-3">{t.quotePublic.rejectReasonPrompt}</p>
        <div className="space-y-1">
          {REJECTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedReason(opt.value)}
              className={[
                'w-full text-left rounded-xl px-3 py-2.5 min-h-11 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                selectedReason === opt.value ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

interface ResponseScreenProps {
  variant: 'accepted' | 'rejected';
  title: string;
  message: string;
  companyName: string;
}

function ResponseScreen({ variant, title, message, companyName }: ResponseScreenProps) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <div
          className={[
            'w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4',
            variant === 'accepted' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500',
          ].join(' ')}
        >
          <Shield size={26} />
        </div>
        <h1 className="text-lg font-semibold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 mb-1">{message}</p>
        <p className="text-xs text-slate-400 mt-4">{companyName}</p>
      </div>
    </div>
  );
}
