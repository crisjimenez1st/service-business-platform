import { t } from './es';
import { JOB_STATUS_LABELS } from '../utils/jobStatus';
import type { BusinessType } from '../types';

type Section = Record<string, string>;
type Copy = Record<string, Section>;

/**
 * Textos de consultorio (dental / médico / otros negocios con citas). Cambian
 * "trabajo", "técnico" y "cliente" por cita, doctor y paciente en todas las
 * pantallas que usan `t`, sin tocar el código de cada pantalla.
 */
const CLINIC_COPY: Copy = {
  nav: { clients: 'Pacientes', jobs: 'Citas', technicians: 'Doctores', payments: 'Pagos', calendar: 'Agenda' },
  calendar: {
    title: 'Agenda',
    unscheduled: 'Sin agendar',
    noJobsToday: 'No hay citas este día.',
    noJobsThisRange: 'No hay citas en este rango.',
    client: 'Paciente',
    technician: 'Doctor',
    unassigned: 'Sin doctor asignado',
    schedule: 'Agendar',
    reschedule: 'Reagendar',
    unschedule: 'Quitar fecha',
    assignTechnician: 'Asignar doctor',
    viewClientProfile: 'Ver ficha del paciente',
    startTravel: 'Paciente llegó',
    startJob: 'Pasar a consulta',
    pauseJob: 'Pausar',
    completeJob: 'Terminar consulta',
    noTechnicians: 'No hay doctores activos todavía.',
  },
  jobsPage: {
    title: 'Citas',
    searchPlaceholder: 'Buscar por paciente...',
    allTechnicians: 'Todos los doctores',
    noResults: 'No hay citas que coincidan con los filtros.',
    sectionUnscheduled: 'Sin agendar',
    sectionScheduled: 'Agendadas',
    sectionActive: 'En consulta',
    sectionCompleted: 'Atendidas',
    sectionCancelled: 'Canceladas',
    viewFullJob: 'Ver cita completa',
    cancelJob: 'Cancelar cita',
    cancelJobTitle: 'Cancelar cita',
    cancelJobWarning: 'La cita no se elimina: queda marcada como cancelada y se conserva en el historial del paciente.',
    cancelReasonPlaceholder: 'Explica por qué se cancela esta cita...',
    cancelCategoryClientRequest: 'El paciente pidió cancelar',
    cancelCategoryNoShow: 'El paciente no llegó',
    cancelCategoryRescheduled: 'Reagendó por otro medio',
    keepJob: 'No cancelar',
  },
  jobDetail: {
    tabSummary: 'La cita',
    tabPayments: 'Pagos',
    tabHistory: 'Historial',
    backToJobs: 'Volver a la agenda',
    notFound: 'No encontramos esa cita.',
    cancelledAt: 'Cancelada el',
    cancellationReason: 'Motivo de la cancelación',
    createdFrom: 'Creada desde un presupuesto aceptado',
    total: 'Precio',
    paidAmount: 'Pagado',
    balance: 'Saldo pendiente',
    dueDate: 'Pagar antes de',
  },
  payments: {
    noTotalNotice: 'Esta cita no tiene precio. Define el precio para poder registrar pagos.',
    termsLockedNotice: 'El precio de una cita atendida o cancelada ya no se puede cambiar.',
    cancelledWithPayments: 'Esta cita está cancelada y tiene dinero cobrado. Los pagos se conservan: revisa si hay que devolverlo.',
    cancelledNoCollect: 'Una cita cancelada ya no genera saldo por cobrar.',
    totalLabel: 'Precio de la cita',
    setTotal: 'Definir precio',
    overdueBadge: 'Atrasado',
    termsTitle: 'Precio y fecha de pago',
    editTerms: 'Editar precio',
    noDueDate: 'Sin fecha límite de pago',
    dueDate: 'Pagar antes de',
    dueDateLabel: 'Fecha límite de pago',
  },
};

/** Etiquetas de estado de una cita en consultorio. */
const CLINIC_STATUS_LABELS = {
  new: 'Sin agendar',
  scheduled: 'Agendada',
  en_route: 'Llegó',
  in_progress: 'En consulta',
  paused: 'En pausa',
  completed: 'Atendida',
  cancelled: 'Cancelada',
} as const;

let original: { copy: Copy; status: Record<string, string> } | null = null;

/**
 * Aplica el vocabulario según el tipo de negocio. Se llama cuando se carga la
 * empresa, antes de que se pinten las pantallas; servicios técnicos restaura
 * el texto original.
 */
export function applyBusinessCopy(businessType: BusinessType | undefined): void {
  const target = t as unknown as Copy;
  if (!original) {
    original = {
      copy: Object.fromEntries(Object.keys(CLINIC_COPY).map((k) => [k, { ...(target[k] ?? {}) }])),
      status: { ...JOB_STATUS_LABELS },
    };
  }
  const clinic = businessType !== undefined && businessType !== 'technical_services';
  for (const section of Object.keys(CLINIC_COPY)) {
    if (!target[section]) continue;
    Object.assign(target[section], clinic ? CLINIC_COPY[section] : original.copy[section]);
  }
  Object.assign(JOB_STATUS_LABELS, clinic ? CLINIC_STATUS_LABELS : original.status);
}
