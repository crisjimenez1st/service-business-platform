import { create } from 'zustand';
import type { Opportunity } from '../types';
import * as opportunityService from '../services/opportunityService';
import type { OpportunityDomainInput } from '../services/mappers/opportunityMapper';
import type { ServiceError } from '../services/errors/serviceError';

interface OpportunityState {
  opportunities: Opportunity[];
  companyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string) => Promise<void>;
  create: (input: OpportunityDomainInput) => Promise<Opportunity | null>;
  postpone: (id: string, newDate: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
  markContacted: (id: string) => Promise<void>;
}

/**
 * Segundo store real sobre Supabase (tras clientStore) -- mismo patrón:
 * companyId interno fijado en `load`, invalidación inmediata de
 * `opportunities`/`error` si cambia la empresa activa (nunca mostrar
 * datos de la empresa anterior mientras carga la nueva), loadToken
 * para descartar respuestas tardías de una carga ya superada por otra
 * más reciente, y actualización optimista SOLO si el servicio confirma
 * éxito.
 */
let loadToken = 0;

export const useOpportunityStore = create<OpportunityState>((set, get) => ({
  opportunities: [],
  companyId: null,
  loading: false,
  error: null,

  load: async (companyId: string) => {
    const myToken = ++loadToken;
    const isCompanyChange = get().companyId !== companyId;

    if (isCompanyChange) {
      set({ opportunities: [], error: null, companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }

    const result = await opportunityService.getOpportunities(companyId);
    if (myToken !== loadToken) return;

    if (result.error) {
      set({ opportunities: [], error: result.error, loading: false });
    } else {
      set({ opportunities: result.data, loading: false });
    }
  },

  create: async (input: OpportunityDomainInput) => {
    const { companyId } = get();
    if (!companyId) return null;
    const result = await opportunityService.createOpportunity(companyId, input);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ opportunities: [result.data, ...get().opportunities], error: null });
    return result.data;
  },

  postpone: async (id: string, newDate: string) => {
    const { companyId } = get();
    if (!companyId) return;
    const result = await opportunityService.postponeOpportunity(companyId, id, newDate);
    if (result.error) {
      set({ error: result.error });
      return;
    }
    set({
      opportunities: get().opportunities.map((o) => (o.id === id ? result.data : o)),
      error: null,
    });
  },

  discard: async (id: string) => {
    const { companyId } = get();
    if (!companyId) return;
    const result = await opportunityService.discardOpportunity(companyId, id);
    if (result.error) {
      set({ error: result.error });
      return;
    }
    set({
      opportunities: get().opportunities.map((o) => (o.id === id ? result.data : o)),
      error: null,
    });
  },

  markContacted: async (id: string) => {
    const { companyId } = get();
    if (!companyId) return;
    const result = await opportunityService.markContacted(companyId, id);
    if (result.error) {
      set({ error: result.error });
      return;
    }
    set({
      opportunities: get().opportunities.map((o) => (o.id === id ? result.data : o)),
      error: null,
    });
  },
}));
