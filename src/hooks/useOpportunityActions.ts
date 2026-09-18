import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpportunityStore } from '../store/opportunityStore';
import { useQuoteStore } from '../store/quoteStore';
import { useClientsById } from './useClientsById';
import type { ServiceError } from '../services/errors/serviceError';
import { formatCurrency } from '../utils/currency';
import { opportunityWhatsAppMessage } from '../utils/whatsapp';

/**
 * Encapsula el flujo UI de posponer/descartar/contactar/convertir una
 * oportunidad, para reutilizar el mismo comportamiento en Dashboard,
 * Oportunidades y el Perfil del Cliente sin duplicar estado local ni
 * la lógica de resolver cliente/mensaje en cada página.
 *
 * Nota sobre migración a Supabase: postpone/discard/markContacted del
 * store son async (consultan Supabase), pero los handlers de este hook
 * (confirmPostpone, confirmDiscard, confirmContact) las invocan sin
 * esperar la promesa y cierran su modal de inmediato -- si la operación
 * falla, el modal ya se cerró y el error solo se ve reflejado en la
 * lista (vía opportunityStore.error + ErrorState en OpportunitiesPage/
 * DashboardPage), no en el propio modal en el momento del fallo.
 * Aceptable para este bloque -- mejorarlo a un feedback inline en el
 * modal mismo queda como posible ajuste de UX futuro.
 *
 * "Crear cotización" (handleCreateQuote) es distinto de las demás
 * acciones: SÍ se espera su promesa y SÍ expone un estado de carga
 * explícito (creatingQuoteForId), porque ahora ejecuta una RPC real
 * (create_quote_from_opportunity) que crea una Quote + QuoteItems y
 * marca la Opportunity como converted de forma atómica en el
 * servidor -- un doble-click no debe poder disparar dos llamadas
 * concurrentes mientras la primera sigue en curso. La protección
 * DEFINITIVA contra duplicados es la propia RPC (rechaza convertir una
 * Opportunity que ya está converted), no este estado de UI -- deshabilitar
 * el botón es solo la primera línea de defensa, no la única.
 */
export function useOpportunityActions() {
  const navigate = useNavigate();
  const [postponeTargetId, setPostponeTargetId] = useState<string | null>(null);
  const [discardTargetId, setDiscardTargetId] = useState<string | null>(null);
  const [contactTargetId, setContactTargetId] = useState<string | null>(null);
  const [creatingQuoteForId, setCreatingQuoteForId] = useState<string | null>(null);
  const [createQuoteError, setCreateQuoteError] = useState<ServiceError | null>(null);

  const opportunities = useOpportunityStore((s) => s.opportunities);
  const postpone = useOpportunityStore((s) => s.postpone);
  const discard = useOpportunityStore((s) => s.discard);
  const markContacted = useOpportunityStore((s) => s.markContacted);
  const loadOpportunities = useOpportunityStore((s) => s.load);
  const opportunitiesCompanyId = useOpportunityStore((s) => s.companyId);
  const createFromOpportunity = useQuoteStore((s) => s.createFromOpportunity);
  const { clientsById } = useClientsById();

  function openPostpone(id: string) {
    setPostponeTargetId(id);
  }

  function openDiscard(id: string) {
    setDiscardTargetId(id);
  }

  function openContact(id: string) {
    setContactTargetId(id);
  }

  function confirmPostpone(newDate: string) {
    if (postponeTargetId) postpone(postponeTargetId, newDate);
    setPostponeTargetId(null);
  }

  function confirmDiscard() {
    if (discardTargetId) discard(discardTargetId);
    setDiscardTargetId(null);
  }

  /** Se llama cuando el usuario elige un canal (llamar/WhatsApp) en ContactSheet. */
  function confirmContact() {
    if (contactTargetId) markContacted(contactTargetId);
  }

  /**
   * Se llama al pulsar "Enviar oferta" (WhatsApp directo desde la tarjeta,
   * sin pasar por ContactSheet). Mismo efecto que confirmContact: marca
   * la oportunidad como contactada para que siga visible con su insignia
   * en vez de desaparecer.
   */
  function sendOffer(id: string) {
    markContacted(id);
  }

  /**
   * Ejecuta create_quote_from_opportunity (única responsable de crear
   * Quote + QuoteItems, calcular totales, generar número y token
   * público, y marcar la Opportunity como converted -- todo atómico en
   * el servidor). Si tiene éxito, navega a /quotes/:id/edit para que el
   * usuario revise/ajuste el borrador antes de enviarlo. Si falla, la
   * Opportunity NO queda convertida (la transacción de la RPC se
   * revierte completa) y se expone el error para que la UI lo muestre
   * y permita reintentar.
   *
   * `items` viene de la propia Opportunity: un ítem único con su
   * título y valor estimado -- el usuario puede editar/agregar más
   * ítems ya dentro del formulario antes de guardar.
   */
  async function handleCreateQuote(id: string) {
    if (creatingQuoteForId) return; // ya hay una creación en curso -- ignora el segundo click
    const opportunity = opportunities.find((o) => o.id === id);
    if (!opportunity) return;

    setCreatingQuoteForId(id);
    setCreateQuoteError(null);

    const quote = await createFromOpportunity({
      opportunityId: id,
      items: [{ description: opportunity.title, quantity: 1, unitPrice: opportunity.estimatedValue }],
    });

    setCreatingQuoteForId(null);

    if (!quote) {
      setCreateQuoteError({
        kind: 'unknown',
        message: 'No pudimos crear la cotización. Intenta de nuevo.',
      });
      return;
    }

    // Refresca la oportunidad desde Supabase -- ahora debe verse como
    // 'converted' (lo marcó la propia RPC), así que desaparece de las
    // listas de vigentes sin que este hook tenga que actualizar el
    // estado local a mano.
    if (opportunitiesCompanyId) loadOpportunities(opportunitiesCompanyId);

    navigate(`/quotes/${quote.id}/edit`);
  }

  // Resuelto aquí (no en cada página) para que ContactSheet reciba
  // directamente cliente y mensaje sin que el caller repita el .find().
  const contactTargetClient = useMemo(() => {
    const opp = opportunities.find((o) => o.id === contactTargetId);
    return opp ? clientsById[opp.clientId] : undefined;
  }, [opportunities, contactTargetId, clientsById]);

  const contactWhatsAppMessage = useMemo(() => {
    const opp = opportunities.find((o) => o.id === contactTargetId);
    if (!opp || !contactTargetClient) return '';
    return opportunityWhatsAppMessage(
      contactTargetClient.name,
      opp.title,
      formatCurrency(opp.estimatedValue)
    );
  }, [opportunities, contactTargetId, contactTargetClient]);

  return {
    postponeTargetId,
    discardTargetId,
    contactTargetId,
    contactTargetClient,
    contactWhatsAppMessage,
    creatingQuoteForId,
    createQuoteError,
    openPostpone,
    openDiscard,
    openContact,
    confirmPostpone,
    confirmDiscard,
    confirmContact,
    sendOffer,
    createQuote: handleCreateQuote,
    closePostpone: () => setPostponeTargetId(null),
    closeDiscard: () => setDiscardTargetId(null),
    closeContact: () => setContactTargetId(null),
  };
}
