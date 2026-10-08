import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import OneFlowMark from '../brand/OneFlowMark';
import { useNavItems } from '../../hooks/useNavItems';
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
  const { primary, secondary } = useNavItems();

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    [
      'group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm lg:text-base font-medium md:justify-center lg:justify-start',
      'transition-all duration-200 ease-out motion-reduce:transition-none',
      'hover:bg-brand-50 hover:text-brand-700 hover:translate-x-0.5 motion-reduce:hover:translate-x-0',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600',
    ].join(' ');

  // Nota: user.email siempre existe con auth por email+password; el
  // nombre completo del usuario (profiles.full_name) todavía no se
  // carga en ningún contexto -- fuera de alcance de este bloque
  // (Auth + CompanyProvider). Mostrar el email es suficiente por ahora.
  const displayName = user?.email ?? '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="hidden md:flex md:flex-col md:w-[84px] lg:w-64 shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0 z-30">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-100">
        <OneFlowMark size={36} className="shrink-0" />
        <span className="hidden lg:block font-semibold text-slate-900 truncate">
          {company?.name ?? '—'}
        </span>
      </div>

      <nav className="flex-1 md:overflow-visible lg:overflow-y-auto px-3 py-4 space-y-1">
        {primary.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClasses}>
            <NavContent icon={<item.icon size={24} className="shrink-0 transition-transform duration-200 group-hover:scale-110 motion-reduce:transform-none" />} label={item.label} />
          </NavLink>
        ))}

        <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
          {secondary.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClasses}>
              <NavContent icon={<item.icon size={24} className="shrink-0 transition-transform duration-200 group-hover:scale-110 motion-reduce:transform-none" />} label={item.label} />
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
          className="group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm lg:text-base font-medium text-slate-500 w-full md:justify-center lg:justify-start transition-all duration-200 ease-out motion-reduce:transition-none hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <NavContent icon={<LogOut size={24} className="shrink-0 transition-transform duration-200 group-hover:scale-110 motion-reduce:transform-none" />} label={t.nav.logout} />
        </button>
      </div>
    </aside>
  );
}

/** Icono + etiqueta. En el rail angosto (sin etiqueta visible) la etiqueta aparece como globo al pasar el mouse o enfocar. */
function NavContent({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <>
      {icon}
      <span className="hidden lg:block truncate">{label}</span>
      <span
        aria-hidden="true"
        className="lg:hidden pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 -translate-x-1 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        {label}
      </span>
    </>
  );
}
