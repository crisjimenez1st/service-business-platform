import { createContext } from 'react';
import type { CompanyMemberRoleDb } from '../types/database.types';

export interface CurrentCompany {
  id: string;
  name: string;
  currency: string;
  logoUrl: string | null;
  /** Zona horaria IANA de la empresa (ej. "America/Managua"), ver companies.timezone (migración 010). Usada por el calendario para agrupar/presentar fechas correctamente -- nunca UTC ni la timezone del navegador. */
  timezone: string;
  role: CompanyMemberRoleDb;
}

export interface CompanyContextValue {
  company: CurrentCompany | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);
