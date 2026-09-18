import { NavLink, useNavigate } from 'react-router-dom';
import { PRIMARY_NAV, MORE_NAV_ITEM } from './navConfig';

interface BottomNavProps {
  onMoreClick: () => void;
}

/**
 * Navegación inferior tipo app, fija, solo visible en móvil (< md).
 * Cada botón tiene área táctil amplia y label visible (no solo icono).
 *
 * A 320px de ancho cada una de las 5 columnas mide 64px: se usa
 * `shortLabel` (definido en navConfig) para los labels más largos,
 * fuente reducida a 10px, y `truncate` + `px-0.5` como red de
 * seguridad final para que ningún texto desborde su columna.
 */
export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const navigate = useNavigate();
  const items = [...PRIMARY_NAV, MORE_NAV_ITEM];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      <div className="grid grid-cols-5 h-16">
        {items.map((item) => {
          const isMore = item.path === '/more';
          const Icon = item.icon;
          const displayLabel = item.shortLabel ?? item.label;

          if (isMore) {
            return (
              <button
                key={item.path}
                onClick={() => {
                  onMoreClick();
                  navigate('/more');
                }}
                className="flex flex-col items-center justify-center gap-0.5 px-0.5 text-slate-500 active:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 min-w-0"
              >
                <Icon size={22} />
                <span className="text-[10px] leading-tight font-medium truncate max-w-full">
                  {displayLabel}
                </span>
              </button>
            );
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5 px-0.5 min-w-0',
                  'active:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                  isActive ? 'text-brand-600' : 'text-slate-500',
                ].join(' ')
              }
            >
              <Icon size={22} />
              <span className="text-[10px] leading-tight font-medium truncate max-w-full">
                {displayLabel}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
