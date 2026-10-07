import { create } from 'zustand';
import type { AppointmentResponse, AppointmentResponseValue, Job } from '../types';
import * as jobService from '../services/jobService';
import * as appointmentService from '../services/appointmentService';
import type { ServiceError } from '../services/errors/serviceError';
import { addDaysToDateKey } from '../utils/followupDates';
import { getTodayKeyInTimezone, localDateTimeToTimezoneIso } from '../utils/timezone';

interface TomorrowState {
  jobs: Job[];
  /** Estado de recordatorio/respuesta por cita (persistido en el servidor). */
  responses: Record<string, AppointmentResponse>;
  companyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string, timezone: string) => Promise<void>;
  /** Crea (si hace falta) el enlace de la cita y devuelve su token. */
  prepareLink: (jobId: string) => Promise<{ token: string | null; error: ServiceError | null }>;
  markReminded: (jobId: string) => Promise<ServiceError | null>;
  setResponse: (jobId: string, response: AppointmentResponseValue | null) => Promise<ServiceError | null>;
}

let loadToken = 0;

function patchResponse(
  responses: Record<string, AppointmentResponse>,
  jobId: string,
  patch: Partial<AppointmentResponse>
): Record<string, AppointmentResponse> {
  return { ...responses, [jobId]: { ...(responses[jobId] ?? { jobId }), ...patch } };
}

/**
 * Citas de mañana (día calendario de la empresa, no UTC) que siguen
 * vigentes: se excluyen las canceladas y las completadas. El estado de
 * recordatorio y de respuesta vive en appointment_responses (migración
 * 016): sobrevive a recargas y al cambio de dispositivo.
 */
export const useTomorrowStore = create<TomorrowState>((set, get) => ({
  jobs: [],
  responses: {},
  companyId: null,
  loading: false,
  error: null,

  load: async (companyId, timezone) => {
    const myToken = ++loadToken;
    if (get().companyId !== companyId) {
      set({ jobs: [], responses: {}, error: null, companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }
    const today = getTodayKeyInTimezone(timezone);
    const start = localDateTimeToTimezoneIso(`${addDaysToDateKey(today, 1)}T00:00`, timezone);
    const end = localDateTimeToTimezoneIso(`${addDaysToDateKey(today, 2)}T00:00`, timezone);
    const result = await jobService.getJobsInRange(companyId, start, end);
    if (myToken !== loadToken) return;
    if (result.error) {
      set({ jobs: [], responses: {}, error: result.error, loading: false });
      return;
    }
    const jobs = result.data.filter((j) => j.status !== 'cancelled' && j.status !== 'completed');
    const resp = await appointmentService.getAppointmentResponses(companyId, jobs.map((j) => j.id));
    if (myToken !== loadToken) return;
    if (resp.error) {
      set({ jobs: [], responses: {}, error: resp.error, loading: false });
      return;
    }
    const map: Record<string, AppointmentResponse> = {};
    resp.data.forEach((r) => {
      map[r.jobId] = r;
    });
    set({ jobs, responses: map, loading: false });
  },

  prepareLink: async (jobId) => {
    const result = await appointmentService.prepareAppointmentLink(jobId);
    if (result.error) return { token: null, error: result.error };
    return { token: result.data, error: null };
  },

  markReminded: async (jobId) => {
    const result = await appointmentService.markAppointmentReminded(jobId);
    if (result.error) return result.error;
    set({ responses: patchResponse(get().responses, jobId, { remindedAt: new Date().toISOString() }) });
    return null;
  },

  setResponse: async (jobId, response) => {
    const result = await appointmentService.setAppointmentResponse(jobId, response);
    if (result.error) return result.error;
    set({
      responses: patchResponse(get().responses, jobId, {
        response: response ?? undefined,
        responseSource: response ? 'staff' : undefined,
      }),
    });
    return null;
  },
}));
