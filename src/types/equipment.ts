import type { UUID } from './core';

export type EquipmentType =
  | 'camera'
  | 'dvr'
  | 'nvr'
  | 'hdd'
  | 'ups'
  | 'cable'
  | 'other';

export interface Equipment {
  id: UUID;
  companyId: UUID;
  clientId: UUID;
  jobId?: UUID;
  type: EquipmentType;
  brand: string;
  model: string;
  serialNumber?: string;
  quantity: number;
  installedDate: string; // ISO date
  warrantyMonths: number;
  maintenanceIntervalMonths: number; // 3, 6, 12...
  estimatedLifespanYears?: number;
  photoUrl?: string;
  notes?: string;
}

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired';

export interface Warranty {
  id: UUID;
  companyId: UUID;
  clientId: UUID;
  equipmentId: UUID;
  startDate: string;
  endDate: string;
  status: WarrantyStatus;
}

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other';
export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export interface Payment {
  id: UUID;
  companyId: UUID;
  clientId: UUID;
  jobId?: UUID;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  notes?: string;
}

export interface MaintenanceSchedule {
  id: UUID;
  companyId: UUID;
  clientId: UUID;
  equipmentId?: UUID;
  jobId?: UUID;
  intervalMonths: number;
  nextDueDate: string;
  lastCompletedDate?: string;
}
