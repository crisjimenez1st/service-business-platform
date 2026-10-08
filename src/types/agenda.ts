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

/** Recibo público de un pago (get_public_receipt, migración 019). */
export interface PublicReceipt {
  companyName: string;
  companyLogoUrl?: string;
  companyPhone?: string;
  clientFirstName: string;
  serviceName: string;
  /** Ausente si el pago fue anulado. */
  amount?: number;
  currency: 'NIO' | 'USD';
  method: string;
  paidAt: string;
  timezone: string;
  jobTotal?: number;
  balance?: number;
  receiptCode: string;
  voided: boolean;
}

/** Registro clínico de una atención (visit_records, migración 020). Solo dueño y doctores. */
export interface VisitRecord {
  jobId: string;
  clientId: string;
  reason?: string;
  diagnosis?: string;
  treatment?: string;
  prescription?: string;
  nextSteps?: string;
  updatedAt: string;
}

export type VisitRecordInput = Omit<VisitRecord, 'jobId' | 'clientId' | 'updatedAt'>;
