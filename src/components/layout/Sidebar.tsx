import { NavLink } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import { PRIMARY_NAV, SECONDARY_NAV } from './navConfig';
import { useAuth } from '../../contexts/useAuth';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { t } from '../../i18n/es';

/**
 * Sidebar responsive:
 * - md (tablet): solo iconos, angosto (rail).
 * - lg+ (desktop): iconos + etiquetas, ancho completo.
 * Oculto por completo en móvil (< md), donde se usa BottomNav.
 */
export default function Sidebar() {
  const { user, signOut } = useAuth();
  const { company } = useCurrentCompany();

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
    ].join(' ');

  // Nota: user.email siempre existe con auth por email+password; el
  // nombre completo del usuario (profiles.full_name) todavía no se
  // carga en ningún contexto -- fuera de alcance de este bloque
  // (Auth + CompanyProvider). Mostrar el email es suficiente por ahora.
  const displayName = user?.email ?? '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="hidden md:flex md:flex-col md:w-[72px] lg:w-64 shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-100">
        <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <Shield size={18} className="text-white" />
        </div>
        <span className="hidden lg:block font-semibold text-slate-900 truncate">
          {company?.name ?? '—'}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClasses}>
            <item.icon size={20} className="shrink-0" />
            <span className="hidden lg:block truncate">{item.label}</span>
          </NavLink>
        ))}

        <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClasses}>
              <item.icon size={20} className="shrink-0" />
              <span className="hidden lg:block truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-slate-100">
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{company?.role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <LogOut size={20} className="shrink-0" />
          <span className="hidden lg:block">{t.nav.logout}</span>
        </button>
      </div>
    </aside>
  );
}
