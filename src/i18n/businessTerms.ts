import type { BusinessType } from '../types';

/**
 * Lenguaje de la app según el tipo de negocio (companies.business_type).
 * El producto es uno solo: esto cambia SOLO las palabras visibles
 * (Paciente/Cita/Doctor vs Cliente/Trabajo/Técnico), nunca las tablas
 * ni los flujos. Las pantallas que todavía no usan este diccionario
 * conservan el texto genérico de i18n/es.ts.
 */
export interface BusinessTerms {
  client: string;
  clients: string;
  newClient: string;
  /** Texto del consentimiento al registrar/editar. */
  acceptsReminders: string;
  job: string;
  jobs: string;
  technician: string;
  technicians: string;
  quotes: string;
  calendar: string;
  followups: string;
  /** Título de la pantalla diaria de avisos. */
  followupsToday: string;
  /** Pregunta al registrar o al terminar una cita. */
  whenReturn: string;
}

export const BUSINESS_TERMS: Record<BusinessType, BusinessTerms> = {
  dental: {
    client: 'Paciente',
    clients: 'Pacientes',
    newClient: 'Nuevo paciente',
    acceptsReminders: 'El paciente acepta recibir recordatorios por WhatsApp',
    job: 'Cita',
    jobs: 'Citas',
    technician: 'Doctor',
    technicians: 'Doctores',
    quotes: 'Presupuestos',
    calendar: 'Agenda',
    followups: 'Seguimientos',
    followupsToday: 'A quién avisar hoy',
    whenReturn: '¿Cuándo debe volver el paciente?',
  },
  medical: {
    client: 'Paciente',
    clients: 'Pacientes',
    newClient: 'Nuevo paciente',
    acceptsReminders: 'El paciente acepta recibir recordatorios por WhatsApp',
    job: 'Cita',
    jobs: 'Citas',
    technician: 'Médico',
    technicians: 'Médicos',
    quotes: 'Presupuestos',
    calendar: 'Agenda',
    followups: 'Seguimientos',
    followupsToday: 'A quién avisar hoy',
    whenReturn: '¿Cuándo debe volver el paciente?',
  },
  technical_services: {
    client: 'Cliente',
    clients: 'Clientes',
    newClient: 'Nuevo cliente',
    acceptsReminders: 'El cliente acepta recibir recordatorios por WhatsApp',
    job: 'Trabajo',
    jobs: 'Trabajos',
    technician: 'Técnico',
    technicians: 'Técnicos',
    quotes: 'Cotizaciones',
    calendar: 'Calendario',
    followups: 'Seguimientos',
    followupsToday: 'A quién avisar hoy',
    whenReturn: '¿Cuándo hay que volver a contactarlo?',
  },
  other: {
    client: 'Cliente',
    clients: 'Clientes',
    newClient: 'Nuevo cliente',
    acceptsReminders: 'El cliente acepta recibir recordatorios por WhatsApp',
    job: 'Cita',
    jobs: 'Citas',
    technician: 'Profesional',
    technicians: 'Profesionales',
    quotes: 'Cotizaciones',
    calendar: 'Agenda',
    followups: 'Seguimientos',
    followupsToday: 'A quién avisar hoy',
    whenReturn: '¿Cuándo debe volver el cliente?',
  },
};

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string; description: string }[] = [
  { value: 'dental', label: 'Clínica dental', description: 'Pacientes, citas, controles y tratamientos con abonos.' },
  { value: 'medical', label: 'Clínica médica', description: 'Pacientes, consultas y controles periódicos.' },
  { value: 'technical_services', label: 'Servicios técnicos', description: 'Clientes, trabajos, técnicos y mantenimientos.' },
  { value: 'other', label: 'Otro negocio', description: 'Estética, veterinaria, fisioterapia y otros negocios con clientes recurrentes.' },
];

export function getBusinessTerms(type: BusinessType | undefined): BusinessTerms {
  return BUSINESS_TERMS[type ?? 'technical_services'];
}

/**
 * Mensaje de recordatorio por defecto, según el tipo de negocio.
 * Siempre genérico: nunca menciona tratamientos, diagnósticos ni datos
 * médicos -- el usuario puede editarlo antes de enviarlo.
 */
export function followupMessage(type: BusinessType | undefined, clientName: string, companyName: string): string {
  const firstName = clientName.trim().split(/\s+/)[0] || clientName;
  switch (type) {
    case 'dental':
      return `Hola ${firstName}, te escribimos de ${companyName}. Ya es momento de tu control. ¿Te agendamos una cita esta semana?`;
    case 'medical':
      return `Hola ${firstName}, te escribimos de ${companyName}. Ya es momento de tu control. ¿Te agendamos una cita esta semana?`;
    case 'other':
      return `Hola ${firstName}, te escribimos de ${companyName}. Queremos saber cómo estás y ofrecerte agendar tu próxima cita. ¿Cuándo te viene bien?`;
    case 'technical_services':
    default:
      return `Hola ${firstName}, te escribimos de ${companyName}. Es momento de coordinar tu próxima visita. ¿Cuándo te viene bien?`;
  }
}
