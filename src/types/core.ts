/**
 * Tipos centrales del sistema.
 * Toda entidad de negocio incluye `companyId` para soportar
 * arquitectura multiempresa (multi-tenant) desde el día 1.
 *
 * Cuando se conecte Supabase/Postgres, estos tipos deben mapear
 * 1:1 (o casi) a las tablas reales. Ver services/README para más detalle.
 */

export type UUID = string;

export type UserRole = 'owner' | 'office' | 'technician';

export interface Company {
  id: UUID;
  name: string;
  logoUrl?: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  currency: CurrencyCode;
  createdAt: string; // ISO date
}

export type CurrencyCode = 'NIO' | 'USD';

export interface User {
  id: UUID;
  companyId: UUID;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  active: boolean;
}

/** Perfil extendido de un usuario con rol technician. */
export interface Technician extends User {
  role: 'technician';
  specialty?: string;
  activeJobsCount?: number;
}

export interface Client {
  id: UUID;
  companyId: UUID;
  name: string;
  phone: string;
  whatsapp: string;
  email?: string;
  address: string;
  mapsUrl?: string;
  notes?: string;
  createdAt: string;
  /** Campos calculados server-side en el futuro; aquí derivados en services/ */
  totalBilled?: number;
  totalPaid?: number;
  pendingBalance?: number;
  lastServiceDate?: string;
  nextMaintenanceDate?: string;
}
