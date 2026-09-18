import { create } from 'zustand';
import type { MyAssignedJob, JobStatus } from '../types';
import * as technicianJobService from '../services/technicianJobService';
import type { ServiceError } from '../services/errors/serviceError';

interface MyJobsState {
  jobs: MyAssignedJob[];
  loading: boolean;
  error: ServiceError | null;
  load: () => Promise<void>;
  updateStatus: (jobId: string, newStatus: string) => Promise<boolean>;
}

/**
 * Store de Jobs para el rol technician (Fase 3, Bloques 2 y 4).
 * Deliberadamente separado de jobStore -- distinto shape de datos
 * (MyAssignedJob, no Job), y no tiene noción de "rango de fechas
 * visible" ni de compañía (get_my_assigned_jobs() no recibe
 * companyId, se deriva de auth.uid() en el servidor) -- un técnico ve
 * toda su agenda de una vez, filtrada por día en el componente de
 * presentación (MobileAgendaView), no en la carga de datos: la
 * cantidad de Jobs asignados a un solo técnico es intrínsecamente
 * pequeña, a diferencia del calendario completo de una empresa.
 */
export const useMyJobsStore = create<MyJobsState>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    const result = await technicianJobService.getMyAssignedJobs();
    if (result.error) {
      set({ jobs: [], error: result.error, loading: false });
    } else {
      set({ jobs: result.data, error: null, loading: false });
    }
  },

  updateStatus: async (jobId: string, newStatus: string) => {
    const result = await technicianJobService.updateJobAsTechnician(jobId, newStatus);
    if (result.error) {
      set({ error: result.error });
      return false;
    }
    set({
      jobs: get().jobs.map((j) =>
        j.id === jobId ? { ...j, status: result.data.status as JobStatus } : j
      ),
      error: null,
    });
    return true;
  },
}));
