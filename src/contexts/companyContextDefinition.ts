import { createContext } from 'react';
import type { CompanyMemberRoleDb } from '../types/database.types';
import type { BusinessType } from '../types';

export interface CurrentCompany {
  id: string;
  name: string;
  currency: string;
  logoUrl: string | null;
  /** Zona horaria IANA de la empresa (ej. "America/Managua"), ver companies.timezone (migración 010). Usada por el calendario para agrupar/presentar fechas correctamente -- nunca UTC ni la timezone del navegador. */
  timezone: string;
  /** Tipo de negocio (companies.business_type): decide el lenguaje y el menú de la app. */
  businessType: BusinessType;
  /** Fin de la prueba gratis y fecha hasta la que está pagado el plan (migración 018). */
  trialEndsAt: string | null;
  paidUntil: string | null;
  /** Enlace público para pedir cita (migración 023). */
  bookingToken: string;
  bookingEnabled: boolean;
  role: CompanyMemberRoleDb;
}

export interface CompanyContextValue {
  company: CurrentCompany | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);
