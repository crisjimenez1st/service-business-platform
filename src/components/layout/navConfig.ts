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
  BellRing,
  ClipboardList,
} from 'lucide-react';
import { t } from '../../i18n/es';
import type { BusinessTerms } from '../../i18n/businessTerms';
import type { BusinessType } from '../../types';
import type { ComponentType } from 'react';

export interface NavItem {
  label: string;
  /** Etiqueta corta para espacios muy estrechos (BottomNav a 320px). */
  shortLabel?: string;
  path: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

export const MORE_NAV_ITEM: NavItem = { label: t.nav.more, path: '/more', icon: MoreHorizontal };

export interface NavItems {
  /** Los 4 destinos principales (+ "Más" en el BottomNav). */
  primary: NavItem[];
  /** Contenido del panel "Más" (bottom sheet en móvil, sección extra en sidebar desktop). */
  secondary: NavItem[];
}

/**
 * Menú según el tipo de negocio. Servicios técnicos conserva el menú
 * original. Clínicas y "otro negocio" ven un menú reducido, pensado
 * para gestión de clientes: sin Equipos, Garantías, Reportes ni
 * Técnicos (las rutas siguen existiendo, solo no se muestran).
 */
export function buildNavItems(businessType: BusinessType, terms: BusinessTerms): NavItems {
  if (businessType === 'technical_services') {
    return {
      primary: [
        { label: t.nav.dashboard, shortLabel: 'Inicio', path: '/dashboard', icon: LayoutDashboard },
        { label: terms.clients, path: '/clients', icon: Users },
        { label: terms.jobs, path: '/jobs', icon: Briefcase },
        { label: t.nav.opportunities, shortLabel: 'Ingresos', path: '/opportunities', icon: TrendingUp },
      ],
      secondary: [
        { label: terms.quotes, path: '/quotes', icon: FileText },
        { label: terms.calendar, path: '/calendar', icon: Calendar },
        { label: terms.followupsToday, path: '/followups', icon: BellRing },
        { label: terms.technicians, path: '/technicians', icon: Wrench },
        { label: t.nav.payments, path: '/collections', icon: Wallet },
        { label: t.nav.equipment, path: '/equipment', icon: HardDrive },
        { label: t.nav.warranties, path: '/warranties', icon: ShieldCheck },
        { label: t.nav.reports, path: '/reports', icon: BarChart3 },
        { label: t.nav.settings, path: '/settings', icon: Settings },
      ],
    };
  }

  return {
    // Menú simple para clínicas: el día (Inicio), la Agenda, los Pacientes y los
    // Cobros. Citas (lista) y Avisos siguen existiendo, pero se llega a ellos desde
    // Inicio y Agenda, no como puertas aparte.
    primary: [
      { label: t.nav.dashboard, shortLabel: 'Inicio', path: '/dashboard', icon: LayoutDashboard },
      { label: terms.calendar, path: '/calendar', icon: Calendar },
      { label: terms.clients, path: '/clients', icon: Users },
      { label: 'Pagos', path: '/collections', icon: Wallet },
    ],
    secondary: [
      { label: 'Registro del mes', path: '/registry', icon: ClipboardList },
      { label: 'Reportes', path: '/reports', icon: BarChart3 },
      { label: t.nav.settings, path: '/settings', icon: Settings },
    ],
  };
}
