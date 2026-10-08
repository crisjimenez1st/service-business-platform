import { create } from 'zustand';
import type { WaitlistEntry } from '../types';
import * as waitlistService from '../services/waitlistService';
import type { ServiceError } from '../services/errors/serviceError';

interface WaitlistState {
  entries: WaitlistEntry[];
  /** Ids a los que ya se les abrió WhatsApp en esta sesión (solo local). */
  sentIds: string[];
  companyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string) => Promise<void>;
  add: (input: { clientId: string; note?: string; service?: string }) => Promise<ServiceError | null>;
  resolve: (entryId: string, status: 'booked' | 'removed') => Promise<ServiceError | null>;
  markSent: (entryId: string) => void;
}

let loadToken = 0;

export const useWaitlistStore = create<WaitlistState>((set, get) => ({
  entries: [],
  sentIds: [],
  companyId: null,
  loading: false,
  error: null,

  load: async (companyId) => {
    const myToken = ++loadToken;
    if (get().companyId !== companyId) {
      set({ entries: [], sentIds: [], error: null, companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }
    const result = await waitlistService.getWaitlist(companyId);
    if (myToken !== loadToken) return;
    if (result.error) set({ entries: [], error: result.error, loading: false });
    else set({ entries: result.data, loading: false });
  },

  add: async (input) => {
    const { companyId } = get();
    if (!companyId) return { kind: 'unknown', message: 'No hay empresa activa.' };
    const result = await waitlistService.addToWaitlist(companyId, input);
    if (result.error) return result.error;
    await get().load(companyId);
    return null;
  },

  resolve: async (entryId, status) => {
    const result = await waitlistService.resolveWaitlistEntry(entryId, status);
    if (result.error) return result.error;
    set({ entries: get().entries.filter((e) => e.id !== entryId) });
    return null;
  },

  markSent: (entryId) => {
    if (!get().sentIds.includes(entryId)) set({ sentIds: [...get().sentIds, entryId] });
  },
}));
