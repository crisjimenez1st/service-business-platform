import { create } from 'zustand';
import type { Job } from '../types';
import * as jobService from '../services/jobService';
import type { ServiceError } from '../services/errors/serviceError';
import { addDaysToDateKey } from '../utils/followupDates';
import { getTodayKeyInTimezone, localDateTimeToTimezoneIso } from '../utils/timezone';

interface TomorrowState {
  jobs: Job[];
  /** Solo locales (esta sesión): el servidor todavía no guarda "confirmada". */
  sentIds: string[];
  confirmedIds: string[];
  companyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string, timezone: string) => Promise<void>;
  markSent: (jobId: string) => void;
  markConfirmed: (jobId: string) => void;
}

let loadToken = 0;

/**
 * Citas de mañana (día calendario de la empresa, no UTC) que siguen
 * vigentes: se excluyen las canceladas y las completadas. "Enviado" y
 * "Confirmó" son marcas locales de la sesión -- no hay columna de
 * confirmación en jobs; si hace falta persistirla, es otra migración.
 */
export const useTomorrowStore = create<TomorrowState>((set, get) => ({
  jobs: [],
  sentIds: [],
  confirmedIds: [],
  companyId: null,
  loading: false,
  error: null,

  load: async (companyId, timezone) => {
    const myToken = ++loadToken;
    if (get().companyId !== companyId) {
      set({ jobs: [], sentIds: [], confirmedIds: [], error: null, companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }
    const today = getTodayKeyInTimezone(timezone);
    const start = localDateTimeToTimezoneIso(`${addDaysToDateKey(today, 1)}T00:00`, timezone);
    const end = localDateTimeToTimezoneIso(`${addDaysToDateKey(today, 2)}T00:00`, timezone);
    const result = await jobService.getJobsInRange(companyId, start, end);
    if (myToken !== loadToken) return;
    if (result.error) {
      set({ jobs: [], error: result.error, loading: false });
    } else {
      set({
        jobs: result.data.filter((j) => j.status !== 'cancelled' && j.status !== 'completed'),
        loading: false,
      });
    }
  },

  markSent: (jobId) => {
    if (!get().sentIds.includes(jobId)) set({ sentIds: [...get().sentIds, jobId] });
  },

  markConfirmed: (jobId) => {
    if (!get().confirmedIds.includes(jobId)) set({ confirmedIds: [...get().confirmedIds, jobId] });
  },
}));
