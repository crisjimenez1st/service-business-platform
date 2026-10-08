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

/** Historial médico del paciente (patient_medical_profiles, migración 021). Solo dueño y doctores. */
export interface MedicalProfile {
  clientId: string;
  allergies?: string;
  medicalHistory?: string;
  medications?: string;
  importantNotes?: string;
  updatedAt: string;
}

export type MedicalProfileInput = Omit<MedicalProfile, 'clientId' | 'updatedAt'>;

export type TreatmentPlanStatus = 'active' | 'completed' | 'cancelled';

/** Abono de un plan de tratamiento (plan_payments, migración 022). */
export interface PlanPayment {
  id: string;
  planId: string;
  amount: number;
  method: string;
  paidAt: string;
  note?: string;
  voidedAt?: string;
  voidReason?: string;
}

/** Plan de tratamiento con abonos (treatment_plans, migración 022). */
export interface TreatmentPlan {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  total: number;
  paidAmount: number;
  currency: 'NIO' | 'USD';
  status: TreatmentPlanStatus;
  createdAt: string;
  payments: PlanPayment[];
}

// ---------- Solicitudes de cita (enlace público) ----------

export type AppointmentRequestStatus = 'pending' | 'handled' | 'dismissed';

export interface AppointmentRequest {
  id: string;
  name: string;
  phone: string;
  /** Últimos 8 dígitos del teléfono: sirve para reconocer a un paciente existente. */
  phoneKey: string;
  service: string;
  preferred?: string;
  note?: string;
  status: AppointmentRequestStatus;
  createdAt: string;
}

export interface PublicBooking {
  companyName: string;
  companyLogoUrl?: string;
  companyPhone?: string;
  services: string[];
}
