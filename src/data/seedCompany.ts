import type { Company, User } from '../types';

export const DEMO_COMPANY_ID = 'company_demo_1';

export const seedCompany: Company = {
  id: DEMO_COMPANY_ID,
  name: 'Seguridad ABC Nicaragua',
  phone: '+505 2255-0101',
  whatsapp: '+50588880101',
  email: 'contacto@seguridadabc.ni',
  address: 'De los semáforos de Altamira, 2c abajo, Managua',
  currency: 'NIO',
  createdAt: '2024-01-10T08:00:00.000Z',
};

export const seedUsers: User[] = [
  {
    id: 'user_owner_1',
    companyId: DEMO_COMPANY_ID,
    name: 'Roberto Sequeira',
    email: 'roberto@seguridadabc.ni',
    role: 'owner',
    active: true,
  },
  {
    id: 'user_office_1',
    companyId: DEMO_COMPANY_ID,
    name: 'María José Rivas',
    email: 'mj@seguridadabc.ni',
    role: 'office',
    active: true,
  },
  {
    id: 'user_tech_1',
    companyId: DEMO_COMPANY_ID,
    name: 'Juan Pérez',
    email: 'juan@seguridadabc.ni',
    role: 'technician',
    phone: '+50588880202',
    active: true,
  },
  {
    id: 'user_tech_2',
    companyId: DEMO_COMPANY_ID,
    name: 'Luis Mendoza',
    email: 'luis@seguridadabc.ni',
    role: 'technician',
    phone: '+50588880303',
    active: true,
  },
];
