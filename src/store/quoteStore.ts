import { create } from 'zustand';
import type { Quote, JobDraft } from '../types';
import * as quoteService from '../services/quoteService';
import * as jobDraftService from '../services/jobDraftService';
import type { ServiceError } from '../services/errors/serviceError';

interface QuoteState {
  quotes: Quote[];
  loadedCompanyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string) => Promise<void>;
  createFromOpportunity: (
    input: quoteService.CreateQuoteFromOpportunityInput
  ) => Promise<Quote | null>;
  create: (input: quoteService.CreateQuoteInput) => Promise<Quote | null>;
  update: (id: string, input: quoteService.UpdateQuoteInput) => Promise<Quote | null>;
  send: (id: string) => Promise<Quote | null>;
  duplicate: (id: string) => Promise<Quote | null>;
  cancel: (id: string) => Promise<Quote | null>;
  markAccepted: (id: string) => Promise<Quote | null>;
  markRejected: (id: string) => Promise<Quote | null>;
}

/**
 * Tercer store real sobre Supabase (tras clientStore/opportunityStore)
 * -- mismo patrón exacto: `loadedCompanyId` fijado en `load`, invalidación
 * INMEDIATA de `quotes`/`error` si cambia la empresa activa (nunca un
 * instante mostrando datos de la empresa anterior), `loadToken` para
 * descartar respuestas tardías de una carga ya superada por otra más
 * reciente, y actualización optimista SOLO si el servicio confirma éxito.
 *
 * Las transiciones vía token público (markViewedByToken,
 * acceptQuoteByToken, rejectQuoteByToken) NO pasan por este store: la
 * página pública no tiene sesión ni companyId -- llama a quoteService
 * directamente, ver QuotePublicPage.
 */
let loadToken = 0;

export const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes: [],
  loadedCompanyId: null,
  loading: false,
  error: null,

  load: async (companyId: string) => {
    const myToken = ++loadToken;
    const isCompanyChange = get().loadedCompanyId !== companyId;

    if (isCompanyChange) {
      set({ quotes: [], error: null, loadedCompanyId: companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }

    const result = await quoteService.getQuotes(companyId);
    if (myToken !== loadToken) return;

    if (result.error) {
      set({ quotes: [], error: result.error, loading: false });
    } else {
      set({ quotes: result.data, loading: false });
    }
  },

  createFromOpportunity: async (input) => {
    const { loadedCompanyId } = get();
    if (!loadedCompanyId) return null;
    const result = await quoteService.createQuoteFromOpportunity(loadedCompanyId, input);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ quotes: [result.data, ...get().quotes], error: null });
    return result.data;
  },

  create: async (input) => {
    const { loadedCompanyId } = get();
    if (!loadedCompanyId) return null;
    const result = await quoteService.createQuote(loadedCompanyId, input);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ quotes: [result.data, ...get().quotes], error: null });
    return result.data;
  },

  update: async (id, input) => {
    const { loadedCompanyId } = get();
    if (!loadedCompanyId) return null;
    const result = await quoteService.updateQuote(loadedCompanyId, id, input);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ quotes: get().quotes.map((q) => (q.id === id ? result.data : q)), error: null });
    return result.data;
  },

  send: async (id) => {
    const { loadedCompanyId } = get();
    if (!loadedCompanyId) return null;
    const result = await quoteService.sendQuote(loadedCompanyId, id);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ quotes: get().quotes.map((q) => (q.id === id ? result.data : q)), error: null });
    return result.data;
  },

  duplicate: async (id) => {
    const { loadedCompanyId } = get();
    if (!loadedCompanyId) return null;
    const result = await quoteService.duplicateQuote(loadedCompanyId, id);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ quotes: [result.data, ...get().quotes], error: null });
    return result.data;
  },

  cancel: async (id) => {
    const { loadedCompanyId } = get();
    if (!loadedCompanyId) return null;
    const result = await quoteService.cancelQuote(loadedCompanyId, id);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ quotes: get().quotes.map((q) => (q.id === id ? result.data : q)), error: null });
    return result.data;
  },

  markAccepted: async (id) => {
    const { loadedCompanyId } = get();
    if (!loadedCompanyId) return null;
    const result = await quoteService.markAcceptedManually(loadedCompanyId, id);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ quotes: get().quotes.map((q) => (q.id === id ? result.data : q)), error: null });
    return result.data;
  },

  markRejected: async (id) => {
    const { loadedCompanyId } = get();
    if (!loadedCompanyId) return null;
    const result = await quoteService.markRejectedManually(loadedCompanyId, id);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ quotes: get().quotes.map((q) => (q.id === id ? result.data : q)), error: null });
    return result.data;
  },
}));

// ============================================================
// Carga de UNA Quote por id (detalle/formulario de edición) -- store
// separado del anterior porque su forma de estado (un registro + su
// propio loading/error) es distinta de la lista, mismo criterio que
// useSingleClientStore en clientStore.ts. El setState vive aquí
// (acción de Zustand), no en el cuerpo de un useEffect de componente
// -- evita react/set-state-in-effect sin sacrificar loading/error
// explícitos (ver esa misma nota extensa en clientStore.ts).
// ============================================================

interface SingleQuoteState {
  quote: Quote | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string, id: string) => Promise<void>;
  /** Reemplaza el Quote en memoria con uno ya resuelto (ej. tras una acción de useQuoteStore) sin volver a consultar Supabase. */
  setQuote: (quote: Quote) => void;
}

export const useSingleQuoteStore = create<SingleQuoteState>((set) => ({
  quote: null,
  loading: false,
  error: null,

  load: async (companyId: string, id: string) => {
    set({ loading: true, error: null });
    const result = await quoteService.getQuoteById(companyId, id);
    if (result.error) {
      set({ quote: null, error: result.error, loading: false });
    } else {
      set({ quote: result.data, error: null, loading: false });
    }
  },

  setQuote: (quote: Quote) => set({ quote }),
}));

// ============================================================
// Carga del JobDraft de UNA Quote (si existe) -- mismo criterio: store
// dedicado en vez de useState+useEffect en QuoteDetailPage.
// ============================================================

interface QuoteJobDraftState {
  jobDraft: JobDraft | null;
  loading: boolean;
  load: (companyId: string, quoteId: string) => Promise<void>;
  setJobDraft: (jobDraft: JobDraft) => void;
}

export const useQuoteJobDraftStore = create<QuoteJobDraftState>((set) => ({
  jobDraft: null,
  loading: false,

  load: async (companyId: string, quoteId: string) => {
    set({ loading: true });
    const result = await jobDraftService.getJobDraftByQuoteId(companyId, quoteId);
    set({ jobDraft: result.error ? null : result.data, loading: false });
  },

  setJobDraft: (jobDraft: JobDraft) => set({ jobDraft }),
}));

// ============================================================
// Carga de las Quotes de UN cliente (tab "Cotizaciones" en
// ClientProfilePage) -- store separado de useQuoteStore (que carga
// todas las Quotes de la empresa): forma de estado distinta, mismo
// criterio de "setState dentro de la acción, no en el useEffect".
// ============================================================

interface ClientQuotesState {
  quotes: Quote[];
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string, clientId: string) => Promise<void>;
}

export const useClientQuotesStore = create<ClientQuotesState>((set) => ({
  quotes: [],
  loading: false,
  error: null,

  load: async (companyId: string, clientId: string) => {
    set({ loading: true, error: null });
    const result = await quoteService.getQuotesByClient(companyId, clientId);
    if (result.error) {
      set({ quotes: [], error: result.error, loading: false });
    } else {
      set({ quotes: result.data, error: null, loading: false });
    }
  },
}));
