import {
  LayoutDashboard,
  Users,
  Briefcase,
  TrendingUp,
  MoreHorizontal,
  FileText,
  Calendar,
  Wrench,
  Wallet,
  HardDrive,
  ShieldCheck,
  BarChart3,
  Settings,
} from 'lucide-react';
import { t } from '../../i18n/es';
import type { ComponentType } from 'react';

export interface NavItem {
  label: string;
  /** Etiqueta corta para espacios muy estrechos (BottomNav a 320px). */
  shortLabel?: string;
  path: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

/** Los 4 destinos principales + "Más": misma info en móvil y desktop. */
export const PRIMARY_NAV: NavItem[] = [
  { label: t.nav.dashboard, shortLabel: 'Inicio', path: '/dashboard', icon: LayoutDashboard },
  { label: t.nav.clients, path: '/clients', icon: Users },
  { label: t.nav.jobs, path: '/jobs', icon: Briefcase },
  { label: t.nav.opportunities, shortLabel: 'Ingresos', path: '/opportunities', icon: TrendingUp },
];

export const MORE_NAV_ITEM: NavItem = { label: t.nav.more, path: '/more', icon: MoreHorizontal };

/** Contenido del panel "Más" (bottom sheet en móvil, sección extra en sidebar desktop). */
export const SECONDARY_NAV: NavItem[] = [
  { label: t.nav.quotes, path: '/quotes', icon: FileText },
  { label: t.nav.calendar, path: '/calendar', icon: Calendar },
  { label: t.nav.technicians, path: '/technicians', icon: Wrench },
  { label: t.nav.payments, path: '/payments', icon: Wallet },
  { label: t.nav.equipment, path: '/equipment', icon: HardDrive },
  { label: t.nav.warranties, path: '/warranties', icon: ShieldCheck },
  { label: t.nav.reports, path: '/reports', icon: BarChart3 },
  { label: t.nav.settings, path: '/settings', icon: Settings },
];
