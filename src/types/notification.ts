import type { UUID } from './core';

export type NotificationType =
  | 'maintenance_due'
  | 'job_upcoming'
  | 'warranty_expiring'
  | 'payment_pending'
  | 'quote_no_response'
  | 'inactive_client'
  | 'new_opportunity';

export interface AppNotification {
  id: UUID;
  companyId: UUID;
  userId?: UUID; // si es null, visible para todo el equipo con permiso
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedEntityId?: UUID;
}
