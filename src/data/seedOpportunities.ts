import type { Opportunity } from '../types';
import { DEMO_COMPANY_ID } from './seedCompany';
import { monthsAgo, daysFromNow, daysAgo, isoDateOnly } from './dateHelpers';

/**
 * ⚠️ LEGACY / MOCK TEMPORAL -- desde la migración de Opportunities a
 * Supabase, estos datos YA NO alimentan las pantallas reales
 * (OpportunitiesPage, DashboardPage, ClientProfilePage): esas leen de
 * useOpportunityStore, que consulta la tabla `opportunities` de
 * Supabase vía opportunityService.
 *
 * Este seed sigue existiendo únicamente porque otras entidades que
 * todavía no se migran (Jobs, Equipment) referencian estos mismos ids
 * de oportunidad/cliente en sus propios mocks -- eliminarlo ahora
 * rompería esos datos demo. Se retira por completo cuando esas
 * entidades también se migren a Supabase. (Quotes ya se migró
 * completamente y no depende de este seed en absoluto.)
 *
 * No usar este archivo como fuente de datos para ninguna pantalla
 * nueva ni para probar el CRUD real de Opportunities -- para eso se
 * necesita una empresa/datos reales en Supabase.
 */
export const seedOpportunities: Opportunity[] = [
  {
    id: 'opp_1',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_1',
    category: 'maintenance',
    title: 'Mantenimiento de 6 meses',
    reason: 'Última instalación hace 6 meses. Mantenimiento preventivo recomendado.',
    estimatedValue: 1500,
    status: 'active',
    dueDate: isoDateOnly(daysAgo(2)),
    relatedEquipmentId: 'equip_1',
    createdAt: monthsAgo(0),
  },
  {
    id: 'opp_2',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_2',
    category: 'warranty',
    title: 'Garantía por vencer en 30 días',
    reason: 'La garantía del UPS instalado vence pronto. Buen momento para ofrecer contrato de mantenimiento anual.',
    estimatedValue: 3500,
    status: 'active',
    dueDate: isoDateOnly(daysFromNow(30)),
    relatedEquipmentId: 'equip_7',
    createdAt: monthsAgo(0),
  },
  {
    id: 'opp_3',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_5',
    category: 'inactive_client',
    title: '12 meses sin mantenimiento',
    reason: 'No se ha realizado servicio desde hace 12 meses. Riesgo de deterioro del sistema.',
    estimatedValue: 5000,
    status: 'active',
    dueDate: isoDateOnly(daysAgo(15)),
    createdAt: monthsAgo(0),
  },
  {
    id: 'opp_4',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_4',
    category: 'maintenance',
    title: 'Mantenimiento trimestral',
    reason: 'Sistema grande (22 cámaras) con mantenimiento cada 3 meses. Próximo vencido.',
    estimatedValue: 2800,
    status: 'active',
    dueDate: isoDateOnly(daysAgo(5)),
    relatedEquipmentId: 'equip_4',
    createdAt: monthsAgo(0),
  },
  {
    id: 'opp_5',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_3',
    category: 'expansion',
    title: 'Posible ampliación a 2 sucursales',
    reason: 'Cliente mencionó interés en instalar cámaras en sus 2 sucursales adicionales.',
    estimatedValue: 12000,
    status: 'active',
    dueDate: isoDateOnly(daysFromNow(10)),
    createdAt: monthsAgo(1),
  },
  {
    id: 'opp_6',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_1',
    category: 'upsell',
    title: 'Cambio de disco duro recomendado',
    reason: 'El HDD tiene más de 2 años de antigüedad. Riesgo de falla y pérdida de grabaciones.',
    estimatedValue: 2200,
    status: 'active',
    dueDate: isoDateOnly(daysFromNow(20)),
    relatedEquipmentId: 'equip_3',
    createdAt: monthsAgo(0),
  },
  {
    id: 'opp_7',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_4',
    category: 'upsell',
    title: 'Limpieza de cámaras',
    reason: 'Cámaras exteriores con acumulación visible de polvo según última visita.',
    estimatedValue: 1200,
    status: 'active',
    dueDate: isoDateOnly(daysFromNow(7)),
    createdAt: monthsAgo(0),
  },
  {
    id: 'opp_8',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_6',
    category: 'equipment_replacement',
    title: 'Cámaras próximas a fin de vida útil',
    reason: 'Cámaras con más de 4 años de uso, rendimiento decreciente reportado.',
    estimatedValue: 6500,
    status: 'postponed',
    dueDate: isoDateOnly(daysFromNow(45)),
    postponedTo: isoDateOnly(daysFromNow(45)),
    createdAt: monthsAgo(2),
  },
  {
    id: 'opp_9',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_2',
    category: 'upsell',
    title: 'Actualización de cámaras a 4K',
    reason: 'Cliente preguntó por mejoras de calidad de imagen en visita anterior.',
    estimatedValue: 8500,
    status: 'discarded',
    dueDate: isoDateOnly(daysAgo(20)),
    discardedAt: isoDateOnly(daysAgo(3)),
    discardedReason: 'Cliente decidió posponer inversión indefinidamente.',
    createdAt: monthsAgo(1),
  },
];
