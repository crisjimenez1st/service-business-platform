import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Sheet responsive:
 * - Móvil: aparece desde abajo (bottom-sheet), max-h para nunca desbordar
 *   la pantalla, contenido interno con scroll propio.
 * - Desktop (sm+): modal centrado clásico.
 * Cierra con Escape y bloquea el scroll del body mientras está abierto.
 */
export default function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Efecto separado del de abajo a propósito: SOLO depende de `open`,
  // nunca de `onClose`. Si dependiera de `onClose` (una función que el
  // caller a menudo recrea en cada render -- ej. un handler inline),
  // este efecto se re-ejecutaría en cada tecla que el usuario escribe
  // dentro del Sheet, moviendo el foco de vuelta al botón "Cerrar" y
  // haciendo imposible escribir más de un carácter seguido en un input
  // interno. Mover el foco al abrir es un efecto de "se acaba de
  // montar/abrir", no algo que deba repetirse mientras el diálogo ya
  // está abierto.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div
        className={[
          'relative bg-white w-full sm:max-w-md sm:rounded-2xl sm:mx-4',
          'rounded-t-2xl sm:rounded-t-2xl',
          'max-h-[85vh] sm:max-h-[80vh] flex flex-col',
          'animate-in slide-in-from-bottom sm:zoom-in-95 duration-200',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Cerrar"
            className="min-w-9 min-h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto grow">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
