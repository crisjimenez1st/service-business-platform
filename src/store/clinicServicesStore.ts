import { create } from 'zustand';
import type { ClinicService } from '../types';
import * as svc from '../services/clinicServiceService';
import type { ClinicServiceInput } from '../services/clinicServiceService';
import type { ServiceError } from '../services/errors/serviceError';

interface State {
  services: ClinicService[];
  companyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string) => Promise<void>;
  create: (input: ClinicServiceInput) => Promise<ServiceError | null>;
  update: (id: string, input: ClinicServiceInput) => Promise<ServiceError | null>;
  remove: (id: string) => Promise<ServiceError | null>;
}

let loadToken = 0;
const sortServices = (list: ClinicService[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
const noCompany: ServiceError = { kind: 'unknown', message: 'No hay empresa activa.' };

/** Catálogo de servicios y precios de la empresa activa. */
export const useClinicServicesStore = create<State>((set, get) => ({
  services: [],
  companyId: null,
  loading: false,
  error: null,

  load: async (companyId) => {
    const myToken = ++loadToken;
    if (get().companyId !== companyId) set({ services: [], error: null, companyId, loading: true });
    else set({ loading: true, error: null });
    const result = await svc.getClinicServices(companyId);
    if (myToken !== loadToken) return;
    if (result.error) set({ services: [], error: result.error, loading: false });
    else set({ services: result.data, loading: false });
  },

  create: async (input) => {
    const { companyId } = get();
    if (!companyId) return noCompany;
    const r = await svc.createClinicService(companyId, input);
    if (r.error) return r.error;
    set({ services: sortServices([...get().services, r.data]) });
    return null;
  },

  update: async (id, input) => {
    const { companyId } = get();
    if (!companyId) return noCompany;
    const r = await svc.updateClinicService(companyId, id, input);
    if (r.error) return r.error;
    set({ services: sortServices(get().services.map((s) => (s.id === id ? r.data : s))) });
    return null;
  },

  remove: async (id) => {
    const { companyId } = get();
    if (!companyId) return noCompany;
    const r = await svc.deleteClinicService(companyId, id);
    if (r.error) return r.error;
    set({ services: get().services.filter((s) => s.id !== id) });
    return null;
  },
}));
