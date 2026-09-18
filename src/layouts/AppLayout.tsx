import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import BottomNav from '../components/layout/BottomNav';
import MoreSheet from '../components/layout/MoreSheet';

/**
 * AppLayout: estructura responsive compartida por todas las pantallas
 * autenticadas.
 * - Móvil (< md): sin sidebar, bottom nav fija, padding inferior para
 *   que el contenido no quede oculto detrás de la barra.
 * - Tablet (md): sidebar compacto (rail de iconos).
 * - Desktop (lg+): sidebar completo con etiquetas.
 */
export default function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <main className="pb-20 md:pb-6 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
      <BottomNav onMoreClick={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
