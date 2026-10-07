import { create } from 'zustand';
import type { FollowupDue, InactiveClient, InactiveResolution } from '../types';
import * as followupService from '../services/followupService';
import * as opportunityService from '../services/opportunityService';
import type { ServiceError } from '../services/errors/serviceError';

interface FollowupState {
  items: FollowupDue[];
  inactive: InactiveClient[];
  inactiveLoading: boolean;
  inactiveError: ServiceError | null;
  /** Ids a los que ya se les abrió WhatsApp en esta sesión (solo local: no cambia nada en el servidor). */
  sentIds: string[];
  companyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string) => Promise<void>;
  loadInactive: (companyId: string) => Promise<void>;
  resolveInactive: (clientId: string, action: InactiveResolution, date?: string) => Promise<boolean>;
  markSent: (opportunityId: string) => void;
  booked: (opportunityId: string) => Promise<boolean>;
  postpone: (opportunityId: string, newDate: string) => Promise<boolean>;
  discard: (opportunityId: string) => Promise<boolean>;
}

let loadToken = 0;
let inactiveToken = 0;

/**
 * Store de "A quién avisar hoy". Mismo patrón que el resto: companyId
 * interno, invalidación inmediata al cambiar de empresa, loadToken
 * contra respuestas tardías, y la lista local solo cambia si el servidor
 * confirma el resultado.
 */
export const useFollowupStore = create<FollowupState>((set, get) => ({
  items: [],
  inactive: [],
  inactiveLoading: false,
  inactiveError: null,
  sentIds: [],
  companyId: null,
  loading: false,
  error: null,

  load: async (companyId) => {
    const myToken = ++loadToken;
    if (get().companyId !== companyId) {
      set({ items: [], inactive: [], sentIds: [], error: null, inactiveError: null, companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }
    const result = await followupService.getFollowupsDue(companyId);
    if (myToken !== loadToken) return;
    if (result.error) set({ items: [], error: result.error, loading: false });
    else set({ items: result.data, loading: false });
  },

  loadInactive: async (companyId) => {
    const myToken = ++inactiveToken;
    set({ inactiveLoading: true, inactiveError: null });
    const result = await followupService.getInactiveClients(companyId);
    if (myToken !== inactiveToken) return;
    if (result.error) set({ inactive: [], inactiveError: result.error, inactiveLoading: false });
    else set({ inactive: result.data, inactiveLoading: false });
  },

  resolveInactive: async (clientId, action, date) => {
    const { companyId } = get();
    if (!companyId) return false;
    const result = await followupService.resolveInactiveClient(companyId, clientId, action, date);
    if (result.error) {
      set({ inactiveError: result.error });
      return false;
    }
    set({ inactive: get().inactive.filter((c) => c.clientId !== clientId), inactiveError: null });
    return true;
  },

  markSent: (opportunityId) => {
    if (!get().sentIds.includes(opportunityId)) set({ sentIds: [...get().sentIds, opportunityId] });
  },

  booked: async (opportunityId) => {
    const { companyId } = get();
    if (!companyId) return false;
    const result = await followupService.markFollowupBooked(companyId, opportunityId);
    if (result.error) {
      set({ error: result.error });
      return false;
    }
    set({ items: get().items.filter((i) => i.opportunityId !== opportunityId), error: null });
    return true;
  },

  postpone: async (opportunityId, newDate) => {
    const { companyId } = get();
    if (!companyId) return false;
    const result = await opportunityService.postponeOpportunity(companyId, opportunityId, newDate);
    if (result.error) {
      set({ error: result.error });
      return false;
    }
    set({ items: get().items.filter((i) => i.opportunityId !== opportunityId), error: null });
    return true;
  },

  discard: async (opportunityId) => {
    const { companyId } = get();
    if (!companyId) return false;
    const result = await opportunityService.discardOpportunity(companyId, opportunityId);
    if (result.error) {
      set({ error: result.error });
      return false;
    }
    set({ items: get().items.filter((i) => i.opportunityId !== opportunityId), error: null });
    return true;
  },
}));
