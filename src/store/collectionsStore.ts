import { create } from 'zustand';
import type { Receivable, ReceivablesSummary, UnpricedJob } from '../types';
import * as paymentService from '../services/paymentService';
import type { ServiceError } from '../services/errors/serviceError';

interface CollectionsState {
  receivables: Receivable[];
  summary: ReceivablesSummary[];
  unpricedJobs: UnpricedJob[];
  loadedCompanyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  /** Carga las tres consultas del Centro de Cobros en paralelo. Cualquier fallo se reporta como error de la pantalla. */
  load: (companyId: string) => Promise<void>;
}

let loadToken = 0;

/**
 * Store del Centro de Cobros (/collections). Solo lectura: registrar y
 * anular pagos ocurre en la pestaña Cobros de /jobs/:id, y esta lista
 * se recarga al volver a entrar. `loadToken` descarta respuestas de
 * cargas anteriores que lleguen tarde (ej. cambio rápido de empresa).
 */
export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  receivables: [],
  summary: [],
  unpricedJobs: [],
  loadedCompanyId: null,
  loading: false,
  error: null,

  load: async (companyId: string) => {
    const myToken = ++loadToken;
    const isCompanyChange = get().loadedCompanyId !== companyId;
    set({
      loading: true,
      error: null,
      ...(isCompanyChange ? { receivables: [], summary: [], unpricedJobs: [] } : {}),
    });

    const [receivablesResult, summaryResult, unpricedResult] = await Promise.all([
      paymentService.getCompanyReceivables(companyId),
      paymentService.getReceivablesSummary(companyId),
      paymentService.getUnpricedJobs(companyId),
    ]);

    if (myToken !== loadToken) return;

    const failure = receivablesResult.error ?? summaryResult.error ?? unpricedResult.error;
    if (failure) {
      set({ loading: false, error: failure });
      return;
    }

    set({
      receivables: receivablesResult.data!,
      summary: summaryResult.data!,
      unpricedJobs: unpricedResult.data!,
      loadedCompanyId: companyId,
      loading: false,
      error: null,
    });
  },
}));
