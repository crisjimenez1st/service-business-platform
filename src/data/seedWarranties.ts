import type { Warranty } from '../types';
import { DEMO_COMPANY_ID } from './seedCompany';
import { monthsAgo, daysFromNow, isoDateOnly } from './dateHelpers';

export const seedWarranties: Warranty[] = [
  {
    id: 'warranty_1',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_1',
    equipmentId: 'equip_1',
    startDate: isoDateOnly(monthsAgo(6)),
    endDate: isoDateOnly(daysFromNow(180)),
    status: 'active',
  },
  {
    id: 'warranty_2',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_2',
    equipmentId: 'equip_7',
    startDate: isoDateOnly(monthsAgo(14)),
    endDate: isoDateOnly(daysFromNow(30)),
    status: 'expiring_soon',
  },
  {
    id: 'warranty_3',
    companyId: DEMO_COMPANY_ID,
    clientId: 'client_4',
    equipmentId: 'equip_4',
    startDate: isoDateOnly(monthsAgo(20)),
    endDate: isoDateOnly(daysFromNow(400)),
    status: 'active',
  },
];
