import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Plus, User } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState } from '../components/ui';
import ClientPickerSheet from '../components/quotes/ClientPickerSheet';
import QuoteItemEditor, { type EditableQuoteItem } from '../components/quotes/QuoteItemEditor';
import QuoteTotalsEditor from '../components/quotes/QuoteTotalsEditor';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useQuoteStore, useSingleQuoteStore } from '../store/quoteStore';
import { useClientsById } from '../hooks/useClientsById';
import { calculateQuoteTotals, isQuoteEditable } from '../services/quoteService';
import type { ServiceError } from '../services/errors/serviceError';
import { todayIso } from '../utils/dates';
import { t } from '../i18n/es';
import type { Client, Quote } from '../types';

function newLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyItem(): EditableQuoteItem {
  return { localId: newLocalId(), description: '', quantity: 1, unitPrice: 0, discount: 0 };
}

function defaultExpirationDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
}

/**
 * Maneja crear (/quotes/new) y editar un borrador existente
 * (/quotes/:id/edit) -- dos rutas distintas, mismo componente. Ya NO
 * existe el flujo `?fromDraft=<id>`: una cotización que nace de una
 * Oportunidad ya llega aquí como una Quote real en status draft (creada
 * atómicamente por create_quote_from_opportunity desde
 * useOpportunityActions), así que "editar una Quote recién creada
 * desde Opportunity" y "editar cualquier otro borrador" son
 * exactamente el mismo caso -- no necesitan tratamiento especial.
 *
 * La carga de `quote` en modo edición vive en useSingleQuoteStore
 * (store/quoteStore.ts) -- el setState de loading/error ocurre dentro
 * de esa acción de Zustand, no en el cuerpo de un useEffect de este
 * componente (evita react/set-state-in-effect).
 */
export default function QuoteFormPage() {
  const { id } = useParams<{ id: string }>();
  const { company } = useCurrentCompany();
  const companyId = company?.id;

  const isEditMode = Boolean(id);

  const quote = useSingleQuoteStore((s) => s.quote);
  const loadingState = useSingleQuoteStore((s) => s.loading);
  const error = useSingleQuoteStore((s) => s.error);
  const loadQuote = useSingleQuoteStore((s) => s.load);

  useEffect(() => {
    if (isEditMode && id && companyId) loadQuote(companyId, id);
  }, [isEditMode, id, companyId, loadQuote]);

  const loading = isEditMode && (!companyId || loadingState);

  if (!companyId) return null;

  if (isEditMode && loading) {
    return <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>;
  }

  if (isEditMode && error) {
    return <ErrorState message={error.message} />;
  }

  if (isEditMode && !quote) {
    return (
      <div className="pb-4">
        <EmptyState title="Cotización no encontrada" />
      </div>
    );
  }

  // Solo se puede editar un borrador -- si alguien navega directo a
  // /quotes/:id/edit de una Quote ya enviada/aceptada/etc., se
  // redirige a su detalle en vez de mostrar un formulario que la RPC
  // igualmente rechazaría al guardar.
  if (isEditMode && quote && !isQuoteEditable(quote)) {
    return <Navigate to={`/quotes/${quote.id}`} replace />;
  }

  return (
    <QuoteFormInner key={id ?? 'new'} companyId={companyId} quoteId={id} existingQuote={quote ?? undefined} />
  );
}

interface QuoteFormInnerProps {
  companyId: string;
  quoteId: string | undefined;
  existingQuote: Quote | undefined;
}

function QuoteFormInner({ quoteId, existingQuote }: QuoteFormInnerProps) {
  const navigate = useNavigate();
  const { clients, clientsById } = useClientsById();
  const create = useQuoteStore((s) => s.create);
  const update = useQuoteStore((s) => s.update);
  const send = useQuoteStore((s) => s.send);

  const isEditMode = Boolean(quoteId);

  const [selectedClient, setSelectedClient] = useState<Client | undefined>(
    existingQuote ? clientsById[existingQuote.clientId] : undefined
  );
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [items, setItems] = useState<EditableQuoteItem[]>(
    existingQuote && existingQuote.items.length > 0
      ? existingQuote.items.map((item) => ({
          localId: newLocalId(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount ?? 0,
        }))
      : [emptyItem()]
  );
  const [discount, setDiscount] = useState(existingQuote?.discount ?? 0);
  const [tax, setTax] = useState(existingQuote?.tax ?? 0);
  const [notes, setNotes] = useState(existingQuote?.notes ?? '');
  const [expirationDate, setExpirationDate] = useState(
    existingQuote ? existingQuote.expirationDate.slice(0, 10) : defaultExpirationDate()
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ServiceError | null>(null);

  // La spec de esta migración pide que "Crear cotización" no sea
  // instantáneo (ahora ejecuta una RPC real) -- mismo criterio aplica
  // aquí: deshabilitar guardar/enviar mientras `saving` esté en curso
  // evita doble-click disparando dos llamadas concurrentes.

  const { subtotal, total } = calculateQuoteTotals(
    items.map((item) => ({
      subtotal: Math.max(0, item.quantity * item.unitPrice - item.discount),
    })),
    discount,
    tax
  );

  function updateItem(localId: string, patch: Partial<EditableQuoteItem>) {
    setItems((prev) => prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(localId: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.localId !== localId) : prev));
  }

  const canSave = Boolean(selectedClient) && items.some((item) => item.description.trim().length > 0) && !saving;

  function buildItemsPayload() {
    return items
      .filter((item) => item.description.trim().length > 0)
      .map((item) => ({
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      }));
  }

  /**
   * El subtotal/total mostrados en pantalla son solo para la
   * experiencia inmediata del usuario mientras edita -- la RPC
   * (create_quote / update_quote_draft) recalcula todo en SQL a partir
   * de los items crudos y ESE es el valor que termina persistido,
   * nunca el que este componente calculó.
   */
  async function persistQuote(): Promise<Quote | null> {
    if (!selectedClient || !canSave) return null;
    setSaving(true);
    setSaveError(null);

    const result =
      isEditMode && quoteId
        ? await update(quoteId, {
            clientId: selectedClient.id,
            items: buildItemsPayload(),
            discount,
            tax,
            notes: notes.trim() || undefined,
            expirationDate: new Date(expirationDate).toISOString(),
          })
        : await create({
            clientId: selectedClient.id,
            items: buildItemsPayload(),
            discount,
            tax,
            notes: notes.trim() || undefined,
            expirationDate: new Date(expirationDate).toISOString(),
          });

    setSaving(false);
    if (!result) {
      setSaveError({ kind: 'unknown', message: 'No pudimos guardar la cotización. Intenta de nuevo.' });
    }
    return result;
  }

  async function handleSaveDraft() {
    const quote = await persistQuote();
    if (quote) navigate(`/quotes/${quote.id}`);
  }

  async function handleSaveAndSend() {
    const quote = await persistQuote();
    if (quote) {
      await send(quote.id);
      navigate(`/quotes/${quote.id}`);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg -ml-1 px-1"
      >
        <ArrowLeft size={16} />
        {t.common.back}
      </button>

      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
        {isEditMode ? t.quotes.editQuote : t.quotes.newQuote}
      </h1>

      {existingQuote?.opportunityId && (
        <p className="text-sm text-brand-700 bg-brand-50 rounded-xl px-4 py-3">
          {t.quotes.quoteDraftPrefillNote}
        </p>
      )}

      {saveError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveError.message}</p>
      )}

      {/* Cliente */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">{t.quotes.selectClient}</h2>
        <button
          onClick={() => setClientPickerOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-slate-300 px-3 py-3 min-h-11 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User size={16} className="text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            {selectedClient ? (
              <>
                <p className="text-sm font-medium text-slate-900 truncate">{selectedClient.name}</p>
                <p className="text-xs text-slate-500 truncate">{selectedClient.phone}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">{t.quotes.selectClient}</p>
            )}
          </div>
          <ChevronRight size={16} className="text-slate-500 shrink-0" />
        </button>
      </Card>

      {/* Items */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">{t.quotes.items}</h2>
        <div className="space-y-3">
          {items.map((item, index) => (
            <QuoteItemEditor
              key={item.localId}
              item={item}
              index={index}
              canRemove={items.length > 1}
              onChange={updateItem}
              onRemove={removeItem}
            />
          ))}
        </div>
        <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={addItem} className="mt-3">
          {t.quotes.addItem}
        </Button>
      </div>

      {/* Totales */}
      <QuoteTotalsEditor
        subtotal={subtotal}
        discount={discount}
        tax={tax}
        total={total}
        onDiscountChange={setDiscount}
        onTaxChange={setTax}
      />

      {/* Notas */}
      <Card>
        <label className="block text-sm font-semibold text-slate-700 mb-2">{t.quotes.notes}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.quotes.notesPlaceholder}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 resize-none"
        />
      </Card>

      {/* Vencimiento */}
      <Card>
        <label className="block text-sm font-semibold text-slate-700 mb-2">{t.quotes.expirationDate}</label>
        <input
          type="date"
          value={expirationDate}
          min={todayIso()}
          onChange={(e) => setExpirationDate(e.target.value)}
          className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
        />
      </Card>

      {/* Acciones */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 md:static bg-white md:bg-transparent border-t md:border-0 border-slate-200 p-4 md:p-0 flex gap-3">
        <Button variant="secondary" fullWidth disabled={!canSave} onClick={handleSaveDraft}>
          {saving ? t.common.loading : t.quotes.saveDraft}
        </Button>
        <Button fullWidth disabled={!canSave} onClick={handleSaveAndSend}>
          {saving ? t.common.loading : t.quotes.send}
        </Button>
      </div>

      <ClientPickerSheet
        open={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        clients={clients}
        onSelect={setSelectedClient}
      />
    </div>
  );
}
