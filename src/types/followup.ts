import type { UUID } from './core';

/** Un aviso pendiente de hoy (get_followups_due): paciente/cliente al que hay que escribirle. */
export interface FollowupDue {
  opportunityId: UUID;
  clientId: UUID;
  clientName: string;
  clientPhone: string;
  clientWhatsapp?: string;
  title: string;
  reason: string;
  status: 'active' | 'postponed';
  /** Fecha calendario (YYYY-MM-DD) en que había que avisar. */
  dueDate: string;
  daysOverdue: number;
  lastContactedAt?: string;
  lastVisitAt?: string;
}
