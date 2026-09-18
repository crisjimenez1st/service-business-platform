import { Construction } from 'lucide-react';
import { EmptyState } from '../components/ui';

interface ComingSoonPageProps {
  title: string;
}

/**
 * Placeholder para rutas de navegación que existen (Más, Cotizaciones,
 * Calendario, Técnicos, Cobros, Equipos, Garantías, Reportes, Configuración,
 * Trabajos) pero cuya pantalla completa se construye en fases posteriores.
 * Evita rutas rotas o enlaces muertos en la navegación de Fase 1.
 */
export default function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <div className="pb-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-4">{title}</h1>
      <EmptyState
        icon={<Construction size={40} />}
        title="Disponible en una próxima fase"
        description="Esta sección se construirá progresivamente en las siguientes entregas del roadmap."
      />
    </div>
  );
}
