import type { MockJob as Job } from '../types';
import { DEMO_COMPANY_ID } from './seedCompany';
import { monthsAgo, isoDateOnly, todayAt } from './dateHelpers';

const today = isoDateOnly(todayAt(0, 0));

export const seedJobs: Job[] = [
  {
    id: 'job_today_1',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_1',
    technicianId: 'user_tech_1',
    serviceType: 'Instalación 4 cámaras',
    status: 'scheduled',
    scheduledDate: today,
    scheduledTime: '10:00',
    address: 'Reparto Los Robles, casa E-14, Managua',
    mapsUrl: 'https://maps.google.com/?q=12.1150,-86.2540',
    createdAt: monthsAgo(0),
  },
  {
    id: 'job_today_2',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_3',
    technicianId: 'user_tech_2',
    serviceType: 'Mantenimiento preventivo',
    status: 'scheduled',
    scheduledDate: today,
    scheduledTime: '13:30',
    address: 'Del mercado central, 1c norte, Masaya',
    createdAt: monthsAgo(0),
  },
  {
    id: 'job_today_3',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_4',
    technicianId: 'user_tech_1',
    serviceType: 'Revisión de NVR',
    status: 'en_route',
    scheduledDate: today,
    scheduledTime: '15:00',
    address: 'Calle La Calzada, Granada',
    createdAt: monthsAgo(0),
  },
  {
    id: 'job_past_1',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_1',
    technicianId: 'user_tech_1',
    serviceType: 'Instalación 4 cámaras + DVR',
    status: 'completed',
    scheduledDate: isoDateOnly(monthsAgo(6)),
    scheduledTime: '09:00',
    address: 'Reparto Los Robles, casa E-14, Managua',
    total: 18500,
    paidAmount: 10000,
    createdAt: monthsAgo(6),
  },
];
