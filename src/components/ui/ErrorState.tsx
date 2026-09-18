import { AlertCircle } from 'lucide-react';
import Button from './Button';
import { t } from '../../i18n/es';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Estado de error recuperable para listas/detalles que dependen de una
 * consulta a Supabase. Distinto de EmptyState (que comunica "no hay
 * datos", un resultado válido) -- este comunica "no pudimos cargar los
 * datos" y ofrece reintentar cuando la operación tiene sentido repetir
 * (red, timeout). `message` viene siempre de ServiceError.message
 * (services/errors/serviceError.ts), ya en español y listo para
 * mostrar -- este componente no interpreta códigos de error.
 */
export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="text-red-400 mb-3">
        <AlertCircle size={32} />
      </div>
      <p className="text-slate-700 font-medium">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          {t.common.retry}
        </Button>
      )}
    </div>
  );
}
