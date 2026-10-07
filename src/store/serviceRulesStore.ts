import { create } from 'zustand';
import type { ServiceRule } from '../types';
import * as serviceRulesService from '../services/serviceRulesService';
import type { ServiceError } from '../services/errors/serviceError';

interface ServiceRulesState {
  rules: ServiceRule[];
  companyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string) => Promise<void>;
  /** Devuelve el error (para mostrarlo en el formulario) o null si salió bien. */
  create: (input: { serviceName: string; months: number; reason?: string }) => Promise<ServiceError | null>;
  update: (id: string, input: { serviceName: string; months: number; reason?: string }) => Promise<ServiceError | null>;
  remove: (id: string) => Promise<ServiceError | null>;
}

let loadToken = 0;

const sortRules = (rules: ServiceRule[]) =>
  [...rules].sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'es'));

/** Reglas de regreso por servicio de la empresa activa. Mismo patrón que el resto de stores. */
export const useServiceRulesStore = create<ServiceRulesState>((set, get) => ({
  rules: [],
  companyId: null,
  loading: false,
  error: null,

  load: async (companyId) => {
    const myToken = ++loadToken;
    if (get().companyId !== companyId) {
      set({ rules: [], error: null, companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }
    const result = await serviceRulesService.getServiceRules(companyId);
    if (myToken !== loadToken) return;
    if (result.error) set({ rules: [], error: result.error, loading: false });
    else set({ rules: result.data, loading: false });
  },

  create: async (input) => {
    const { companyId } = get();
    if (!companyId) return { kind: 'unknown', message: 'No hay empresa activa.' };
    const result = await serviceRulesService.createServiceRule(companyId, input);
    if (result.error) return result.error;
    set({ rules: sortRules([...get().rules, result.data]) });
    return null;
  },

  update: async (id, input) => {
    const { companyId } = get();
    if (!companyId) return { kind: 'unknown', message: 'No hay empresa activa.' };
    const result = await serviceRulesService.updateServiceRule(companyId, id, input);
    if (result.error) return result.error;
    set({ rules: sortRules(get().rules.map((r) => (r.id === id ? result.data : r))) });
    return null;
  },

  remove: async (id) => {
    const { companyId } = get();
    if (!companyId) return { kind: 'unknown', message: 'No hay empresa activa.' };
    const result = await serviceRulesService.deleteServiceRule(companyId, id);
    if (result.error) return result.error;
    set({ rules: get().rules.filter((r) => r.id !== id) });
    return null;
  },
}));
