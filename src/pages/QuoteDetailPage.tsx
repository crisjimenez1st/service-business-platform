import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Copy, Check, Clock3, Pencil } from 'lucide-react';
import { Card, Badge, Button, EmptyState, ErrorState } from '../components/ui';
import QuoteItemsList from '../components/quotes/QuoteItemsList';
import QuoteTotalsSummary from '../components/quotes/QuoteTotalsSummary';
import DeleteQuoteModal from '../components/quotes/DeleteQuoteModal';
import JobDraftSheet from '../components/quotes/JobDraftSheet';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useQuoteStore, useSingleQuoteStore, useQuoteJobDraftStore } from '../store/quoteStore';
import { useSingleClientStore } from '../store/clientStore';
import { getEffectiveStatus, isQuoteEditable } from '../services/quoteService';
import { createJobDraft } from '../services/jobDraftService';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from '../utils/quoteStatus';
import { formatCurrency } from '../utils/currency';
import { formatDate, formatRelativeTime } from '../utils/dates';
import { quoteWhatsAppMessage, buildWhatsAppLink } from '../utils/whatsapp';
import { buildQuotePublicLink } from '../utils/quoteLink';
import { t } from '../i18n/es';

/**
 * Vista de detalle de UNA cotización ya guardada -- completamente
 * async, sin useMemo para consultas. `quote` y `jobDraft` se cargan vía
 * useSingleQuoteStore/useQuoteJobDraftStore (store/quoteStore.ts),
 * `client` vía useSingleClientStore -- en los tres casos el setState de
 * loading/error vive dentro de la acción de Zustand, no en el cuerpo de
 * un useEffect de este componente (evita react/set-state-in-effect).
 * Las acciones disponibles dependen del effectiveStatus.
 */
export default function QuoteDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { company } = useCurrentCompany();
  const companyId = company?.id;

  const send = useQuoteStore((s) => s.send);
  const duplicate = useQuoteStore((s) => s.duplicate);
  const cancel = useQuoteStore((s) => s.cancel);
  const markAccepted = useQuoteStore((s) => s.markAccepted);
  const markRejected = useQuoteStore((s) => s.markRejected);

  const quote = useSingleQuoteStore((s) => s.quote);
  const quoteLoadingState = useSingleQuoteStore((s) => s.loading);
  const quoteError = useSingleQuoteStore((s) => s.error);
  const loadQuote = useSingleQuoteStore((s) => s.load);
  const setQuote = useSingleQuoteStore((s) => s.setQuote);

  const jobDraft = useQuoteJobDraftStore((s) => s.jobDraft);
  const jobDraftLoading = useQuoteJobDraftStore((s) => s.loading);
  const loadJobDraft = useQuoteJobDraftStore((s) => s.load);
  const setJobDraft = useQuoteJobDraftStore((s) => s.setJobDraft);

  const client = useSingleClientStore((s) => s.client);
  const clientLoadingState = useSingleClientStore((s) => s.loading);
  const clientError = useSingleClientStore((s) => s.error);
  const loadClient = useSingleClientStore((s) => s.load);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [jobDraftSheetOpen, setJobDraftSheetOpen] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    if (id && companyId) loadQuote(companyId, id);
  }, [id, companyId, loadQuote]);

  useEffect(() => {
    if (quote && companyId) loadClient(quote.clientId, companyId);
  }, [quote, companyId, loadClient]);

  // Carga el JobDraft existente (si lo hay) solo cuando la cotización
  // ya está accepted -- para las demás transiciones no tiene sentido
  // consultarlo.
  useEffect(() => {
    if (quote && companyId && quote.status === 'accepted') {
      loadJobDraft(companyId, quote.id);
    }
  }, [quote, companyId, loadJobDraft]);

  const quoteLoading = !companyId || quoteLoadingState;
  const clientLoading = !quote || !companyId || clientLoadingState;

  function refetchQuote() {
    if (id && companyId) loadQuote(companyId, id);
  }

  if (quoteLoading) {
    return <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>;
  }

  if (quoteError) {
    return <ErrorState message={quoteError.message} onRetry={refetchQuote} />;
  }

  if (!quote || !companyId) {
    return (
      <div className="pb-4">
        <EmptyState title="Cotización no encontrada" />
      </div>
    );
  }

  if (clientLoading) {
    return <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>;
  }

  if (clientError) {
    return (
      <ErrorState
        message={clientError.message}
        onRetry={() => loadClient(quote.clientId, companyId)}
      />
    );
  }

  if (!client) {
    return (
      <div className="pb-4">
        <EmptyState title="Cotización no encontrada" />
      </div>
    );
  }

  const effectiveStatus = getEffectiveStatus(quote);
  const editable = isQuoteEditable(quote);
  const publicLink = buildQuotePublicLink(quote.publicToken);
  const whatsappMessage = quoteWhatsAppMessage(
    client.name,
    quote.quoteNumber,
    formatCurrency(quote.total),
    publicLink
  );

  /**
   * Enviar por primera vez SÍ transiciona draft -> sent (vía
   * quoteStore.send, que llama a sendQuote). Distinto de "Reenviar"
   * (ver más abajo, en el bloque sent/viewed/expired): ese botón solo
   * vuelve a abrir el mismo enlace, nunca llama a send().
   */
  async function handleSendFirstTime() {
    setActionPending(true);
    const updated = await send(quote!.id);
    setActionPending(false);
    if (updated) setQuote(updated);
  }

  async function handleDuplicate() {
    setActionPending(true);
    const copy = await duplicate(quote!.id);
    setActionPending(false);
    if (copy) navigate(`/quotes/${copy.id}`);
  }

  async function handleCancel() {
    setActionPending(true);
    const updated = await cancel(quote!.id);
    setActionPending(false);
    if (updated) navigate('/quotes');
  }

  async function handleMarkAccepted() {
    setActionPending(true);
    const updated = await markAccepted(quote!.id);
    setActionPending(false);
    if (updated) setQuote(updated);
  }

  async function handleMarkRejected() {
    setActionPending(true);
    const updated = await markRejected(quote!.id);
    setActionPending(false);
    if (updated) setQuote(updated);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(publicLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  /**
   * "Crear orden de trabajo" -- vía createJobDraft (jobDraftService),
   * que a su vez es un wrapper delgado sobre la RPC create_job_draft
   * (idempotente por quote_id en el servidor). Deshabilitado mientras
   * `actionPending`/`jobDraftLoading` estén activos, para no disparar
   * dos llamadas con un doble-click -- pero la protección REAL contra
   * duplicados es la RPC, no este disabled.
   */
  async function handleCreateJobOrder() {
    if (jobDraft) {
      setJobDraftSheetOpen(true);
      return;
    }
    setActionPending(true);
    const result = await createJobDraft({
      companyId: companyId!,
      clientId: client!.id,
      quoteId: quote!.id,
      title: quote!.items.map((i) => i.description).join(', '),
    });
    setActionPending(false);
    if (!result.error) {
      setJobDraft(result.data);
      setJobDraftSheetOpen(true);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <button
        onClick={() => navigate('/quotes')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg -ml-1 px-1"
      >
        <ArrowLeft size={16} />
        {t.common.back}
      </button>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-600">{quote.quoteNumber}</p>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{client.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{formatDate(quote.issueDate)}</p>
          </div>
          <Badge tone={QUOTE_STATUS_TONES[effectiveStatus]}>{QUOTE_STATUS_LABELS[effectiveStatus]}</Badge>
        </div>

        {quote.opportunityId && <p className="text-xs text-slate-500 mt-1">{t.quotes.fromOpportunity}</p>}

        {quote.viewedAt && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
            <Clock3 size={12} />
            <span>
              {t.quotes.viewedRelative} {formatRelativeTime(quote.viewedAt)}
            </span>
          </div>
        )}

        {effectiveStatus === 'accepted' && (
          <div className="mt-3 bg-emerald-50 text-emerald-800 rounded-xl px-4 py-3 text-center font-semibold tracking-wide">
            {t.quotes.accepted}
          </div>
        )}
      </Card>

      <QuoteItemsList items={quote.items} />

      <QuoteTotalsSummary
        subtotal={quote.subtotal}
        discount={quote.discount}
        tax={quote.tax}
        total={quote.total}
      />

      {quote.notes && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-1.5">{t.quotes.notes}</h2>
          <p className="text-sm text-slate-600 whitespace-pre-line">{quote.notes}</p>
        </Card>
      )}

      <Card>
        <p className="text-xs text-slate-500">
          {t.quotes.expirationDate}: <span className="text-slate-700">{formatDate(quote.expirationDate)}</span>
        </p>
      </Card>

      {/* Acciones según estado efectivo */}
      <div className="grid grid-cols-2 gap-2">
        {editable && (
          <>
            <Button
              variant="secondary"
              icon={<Pencil size={16} />}
              disabled={actionPending}
              onClick={() => navigate(`/quotes/${quote.id}/edit`)}
            >
              Editar
            </Button>
            <a
              href={buildWhatsAppLink(client.whatsapp, whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleSendFirstTime}
            >
              <Button fullWidth variant="success" icon={<MessageCircle size={16} />} disabled={actionPending}>
                {t.quotes.send}
              </Button>
            </a>
            <Button variant="ghost" disabled={actionPending} onClick={handleDuplicate}>
              {t.quotes.duplicate}
            </Button>
            <Button variant="danger" disabled={actionPending} onClick={() => setDeleteModalOpen(true)}>
              {t.quotes.delete}
            </Button>
          </>
        )}

        {!editable && (effectiveStatus === 'sent' || effectiveStatus === 'viewed' || effectiveStatus === 'expired') && (
          <>
            {/* Reenviar: NUNCA transiciona estado, solo reabre el mismo enlace ya generado. */}
            <a
              href={buildWhatsAppLink(client.whatsapp, whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2"
            >
              <Button fullWidth variant="success" icon={<MessageCircle size={16} />}>
                {t.quotes.resend}
              </Button>
            </a>
            <Button variant="secondary" icon={linkCopied ? <Check size={16} /> : <Copy size={16} />} onClick={handleCopyLink}>
              {linkCopied ? t.quotes.linkCopied : t.quotes.copyLink}
            </Button>
            <Button variant="secondary" disabled={actionPending} onClick={handleDuplicate}>
              {t.quotes.duplicate}
            </Button>
            <Button variant="success" disabled={actionPending} onClick={handleMarkAccepted}>
              {t.quotes.markAccepted}
            </Button>
            <Button variant="danger" disabled={actionPending} onClick={handleMarkRejected}>
              {t.quotes.markRejected}
            </Button>
          </>
        )}

        {effectiveStatus === 'accepted' && (
          <>
            <Button
              fullWidth
              className="col-span-2"
              disabled={actionPending || jobDraftLoading}
              onClick={handleCreateJobOrder}
            >
              {t.quotes.createJobOrder}
            </Button>
            <Button variant="secondary" icon={linkCopied ? <Check size={16} /> : <Copy size={16} />} onClick={handleCopyLink}>
              {linkCopied ? t.quotes.linkCopied : t.quotes.copyLink}
            </Button>
            <Button variant="secondary" disabled={actionPending} onClick={handleDuplicate}>
              {t.quotes.duplicate}
            </Button>
            <Button variant="danger" disabled={actionPending} onClick={handleMarkRejected}>
              {t.quotes.markRejected}
            </Button>
          </>
        )}

        {effectiveStatus === 'rejected' && (
          <>
            <Button variant="secondary" disabled={actionPending} onClick={handleDuplicate}>
              {t.quotes.duplicate}
            </Button>
            <Button variant="success" disabled={actionPending} onClick={handleMarkAccepted}>
              {t.quotes.markAccepted}
            </Button>
          </>
        )}

        {effectiveStatus === 'cancelled' && (
          <Button fullWidth variant="secondary" disabled={actionPending} onClick={handleDuplicate} className="col-span-2">
            {t.quotes.duplicate}
          </Button>
        )}
      </div>

      <DeleteQuoteModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleCancel} />
      <JobDraftSheet
        open={jobDraftSheetOpen}
        onClose={() => setJobDraftSheetOpen(false)}
        clientName={client.name}
        title={jobDraft?.title ?? quote.items.map((i) => i.description).join(', ')}
        estimatedTotal={jobDraft?.estimatedTotal ?? quote.total}
      />
    </div>
  );
}
