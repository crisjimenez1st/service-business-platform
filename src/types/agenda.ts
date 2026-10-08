import type { UUID } from './core';

/** Regla "este servicio vuelve en N meses" (service_followup_rules, migración 016). */
export interface ServiceRule {
  id: UUID;
  serviceName: string;
  months: number;
  reason: string;
}

export type WaitlistStatus = 'waiting' | 'booked' | 'removed';

/** Persona en la lista de espera (waitlist_entries). */
export interface WaitlistEntry {
  id: UUID;
  clientId: UUID;
  note: string;
  service: string;
  createdAt: string;
}

export type AppointmentResponseValue = 'confirmed' | 'declined';

/** Estado de recordatorio/confirmación de una cita (appointment_responses). */
export interface AppointmentResponse {
  jobId: UUID;
  response?: AppointmentResponseValue;
  /** Quién marcó la respuesta: el paciente desde su enlace, o la clínica a mano. */
  responseSource?: 'patient' | 'staff';
  remindedAt?: string;
}

/** Lo que ve el paciente en su enlace (get_public_appointment): nunca servicio ni datos internos. */
export interface PublicAppointment {
  companyName: string;
  companyLogoUrl?: string;
  companyPhone?: string;
  clientFirstName: string;
  scheduledStartAt: string;
  timezone: string;
  response?: AppointmentResponseValue;
  canRespond: boolean;
}
