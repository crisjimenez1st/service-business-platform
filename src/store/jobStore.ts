import { create } from 'zustand';
import type { Job, CompanyTechnician } from '../types';
import * as jobService from '../services/jobService';
import type { ServiceError } from '../services/errors/serviceError';

interface JobState {
  /** Jobs del rango de fechas actualmente visible en el calendario (Mes/Semana/Día). */
  jobsInRange: Job[];
  /** Jobs sin programar (status='new', sin scheduled_start_at) -- siempre cargados aparte, nunca dependen del rango visible. */
  unscheduledJobs: Job[];
  /** Todos los Jobs de la empresa, sin filtro de fecha -- usado por JobsPage (lista/filtros), no por el calendario. */
  allJobs: Job[];
  allJobsLoading: boolean;
  technicians: CompanyTechnician[];
  loadedCompanyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  /** Carga los Jobs del rango [rangeStartIso, rangeEndIso) + los Jobs sin programar de la empresa. */
  loadRange: (companyId: string, rangeStartIso: string, rangeEndIso: string) => Promise<void>;
  /** Carga todos los Jobs de la empresa, sin filtro de fecha -- para JobsPage. */
  loadAll: (companyId: string) => Promise<void>;
  loadTechnicians: (companyId: string) => Promise<void>;
  createFromJobDraft: (companyId: string, jobDraftId: string, technicianId?: string) => Promise<Job | null>;
  assignTechnician: (jobId: string, technicianId: string | null) => Promise<Job | null>;
  schedule: (jobId: string, scheduledStartAt: string | null, scheduledEndAt?: string | null) => Promise<Job | null>;
  cancel: (jobId: string, reason: string, category?: string) => Promise<Job | null>;
  advanceStatus: (jobId: string, newStatus: string) => Promise<Job | null>;
}

/**
 * Store de Jobs para owner/office (Fase 3, Bloque 4). Distinto del
 * patrón de quoteStore/opportunityStore en un punto: no carga "todos
 * los Jobs de la empresa" de una vez, porque el calendario navega por
 * rangos de fechas (Mes/Semana/Día) -- cargar el histórico completo
 * sería innecesario y lento. loadRange se llama de nuevo cada vez que
 * cambia el rango visible (mes siguiente, semana anterior, etc.).
 *
 * unscheduledJobs se recarga junto con cada loadRange -- son pocos en
 * la práctica (Jobs recién convertidos desde un JobDraft, esperando
 * que alguien les asigne fecha) y deben estar siempre visibles sin
 * importar qué rango se esté mirando, así que no tiene sentido tratar
 * su carga como un problema de paginación aparte.
 */
let loadToken = 0;

export const useJobStore = create<JobState>((set, get) => ({
  jobsInRange: [],
  unscheduledJobs: [],
  allJobs: [],
  allJobsLoading: false,
  technicians: [],
  loadedCompanyId: null,
  loading: false,
  error: null,

  loadRange: async (companyId: string, rangeStartIso: string, rangeEndIso: string) => {
    const myToken = ++loadToken;
    const isCompanyChange = get().loadedCompanyId !== companyId;

    if (isCompanyChange) {
      set({ jobsInRange: [], unscheduledJobs: [], error: null, loadedCompanyId: companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }

    const [rangeResult, unscheduledResult] = await Promise.all([
      jobService.getJobsInRange(companyId, rangeStartIso, rangeEndIso),
      jobService.getUnscheduledJobs(companyId),
    ]);

    if (myToken !== loadToken) return;

    if (rangeResult.error) {
      set({ jobsInRange: [], unscheduledJobs: [], error: rangeResult.error, loading: false });
      return;
    }
    if (unscheduledResult.error) {
      set({ jobsInRange: rangeResult.data, unscheduledJobs: [], error: unscheduledResult.error, loading: false });
      return;
    }

    set({ jobsInRange: rangeResult.data, unscheduledJobs: unscheduledResult.data, error: null, loading: false });
  },

  loadAll: async (companyId: string) => {
    set({ allJobsLoading: true });
    const result = await jobService.getJobs(companyId);
    if (result.error) {
      set({ allJobs: [], error: result.error, allJobsLoading: false });
    } else {
      set({ allJobs: result.data, error: null, allJobsLoading: false });
    }
  },

  loadTechnicians: async (companyId: string) => {
    const result = await jobService.getActiveTechnicians(companyId);
    if (!result.error) set({ technicians: result.data });
  },

  createFromJobDraft: async (companyId, jobDraftId, technicianId) => {
    const result = await jobService.createJobFromJobDraft(companyId, jobDraftId, technicianId);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    // El Job recién creado nace sin programar (status='new') -- se
    // añade a unscheduledJobs, nunca a jobsInRange (no tiene fecha con
    // la que posicionarse en el rango visible).
    set({ unscheduledJobs: [result.data, ...get().unscheduledJobs], error: null });
    return result.data;
  },

  assignTechnician: async (jobId, technicianId) => {
    const result = await jobService.assignJobTechnician(jobId, technicianId);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({
      jobsInRange: get().jobsInRange.map((j) => (j.id === jobId ? result.data : j)),
      unscheduledJobs: get().unscheduledJobs.map((j) => (j.id === jobId ? result.data : j)),
      allJobs: get().allJobs.map((j) => (j.id === jobId ? result.data : j)),
      error: null,
    });
    return result.data;
  },

  schedule: async (jobId, scheduledStartAt, scheduledEndAt = null) => {
    const result = await jobService.scheduleJob(jobId, scheduledStartAt, scheduledEndAt);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    // Programar mueve el Job de unscheduledJobs a jobsInRange (o
    // viceversa si se desprograma) -- se recalcula ambas listas
    // localmente sin volver a pedir el rango completo al servidor,
    // para que la UI se sienta inmediata.
    const updated = result.data;
    const stillUnscheduled = !updated.scheduledStartAt;
    set({
      jobsInRange: stillUnscheduled
        ? get().jobsInRange.filter((j) => j.id !== jobId)
        : [...get().jobsInRange.filter((j) => j.id !== jobId), updated],
      unscheduledJobs: stillUnscheduled
        ? [...get().unscheduledJobs.filter((j) => j.id !== jobId), updated]
        : get().unscheduledJobs.filter((j) => j.id !== jobId),
      allJobs: get().allJobs.map((j) => (j.id === jobId ? updated : j)),
      error: null,
    });
    return updated;
  },

  cancel: async (jobId, reason, category) => {
    const result = await jobService.cancelJob(jobId, reason, category);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    const updated = result.data;
    set({
      jobsInRange: get().jobsInRange.map((j) => (j.id === jobId ? updated : j)),
      unscheduledJobs: get().unscheduledJobs.map((j) => (j.id === jobId ? updated : j)),
      allJobs: get().allJobs.map((j) => (j.id === jobId ? updated : j)),
      error: null,
    });
    return updated;
  },

  advanceStatus: async (jobId, newStatus) => {
    const result = await jobService.advanceJobStatus(jobId, newStatus);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    const updated = result.data;
    set({
      jobsInRange: get().jobsInRange.map((j) => (j.id === jobId ? updated : j)),
      unscheduledJobs: get().unscheduledJobs.map((j) => (j.id === jobId ? updated : j)),
      allJobs: get().allJobs.map((j) => (j.id === jobId ? updated : j)),
      error: null,
    });
    return updated;
  },
}));
