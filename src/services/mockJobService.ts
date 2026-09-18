import type { MockJob } from '../types';
import * as db from './localDb';
import { TABLES } from './tables';

/**
 * ⚠️ LEGACY/MOCK -- extraído de jobService.ts al reescribir ese
 * archivo con datos reales de Supabase (Fase 3, Bloque 4). Jobs en
 * Dashboard ("Trabajos de hoy") sigue siendo mock por decisión
 * explícita -- fuera de alcance del Bloque 4 (calendario), que migra
 * la gestión real de Jobs pero no toca Dashboard. Se retira cuando esa
 * pantalla también migre a Supabase.
 */

export function getMockJobs(companyId: string): MockJob[] {
  return db.getAllForCompany<MockJob>(TABLES.jobs, companyId);
}

export function getMockTodayJobs(companyId: string): MockJob[] {
  const today = new Date().toISOString().slice(0, 10);
  return getMockJobs(companyId)
    .filter((j) => j.scheduledDate === today)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}
