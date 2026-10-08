import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { t } from '../i18n/es';

/** Textos de la pantalla de pagos pendientes, en lenguaje de consulta (clínicas) o de trabajos (servicios técnicos). */
const CLINIC = {
  title: 'Pagos',
  subtitle: 'Qué pacientes tienen un saldo pendiente',
  outstanding: 'Saldo pendiente',
  overdue: 'Atrasado',
  openJobs: 'pacientes con saldo',
  overdueJobs: 'atrasados',
  unpricedTitle: 'Citas sin precio',
  unpricedDescription: 'Ya fueron atendidas pero no tienen precio, así que todavía no se pueden cobrar.',
  unpricedAction: 'Ver cita',
  searchPlaceholder: 'Buscar por paciente o servicio...',
  overdueBadge: 'Atrasado',
  filterOverdue: 'Atrasados',
  empty: 'No hay saldos pendientes',
  emptyDescription: 'Cuando una cita o tratamiento tenga un saldo por pagar, aparecerá aquí.',
  reviewTitle: 'Requiere revisión',
  reviewDescription: 'Citas canceladas que tienen dinero cobrado. Revisa si hay que devolverlo.',
  forbidden: 'Solo el dueño y la recepción pueden ver los pagos.',
};

export function useCollectionsCopy() {
  const { company } = useCurrentCompany();
  const isClinic = company?.businessType === 'dental' || company?.businessType === 'medical' || company?.businessType === 'other';
  return isClinic ? { ...t.collections, ...CLINIC } : t.collections;
}
