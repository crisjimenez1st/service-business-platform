import type { JobStatus } from '../types';

/**
 * Único lugar donde se definen labels y tonos visuales para JobStatus.
 * Reutilizado tanto por el calendario real (Fase 3, Bloque 4) como por
 * las pantallas mock que todavía no migran (TodayJobCard,
 * JobHistoryCard) -- los 7 valores de estado son idénticos en ambos
 * mundos, solo cambia qué tipo de Job los porta.
 */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  new: 'Nuevo',
  scheduled: 'Programado',
  en_route: 'En camino',
  in_progress: 'En progreso',
  paused: 'Pausado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const JOB_STATUS_TONES: Record<JobStatus, BadgeTone> = {
  new: 'neutral',
  scheduled: 'info',
  en_route: 'warning',
  in_progress: 'warning',
  paused: 'neutral',
  completed: 'success',
  cancelled: 'danger',
};
