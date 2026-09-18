import { Wrench } from 'lucide-react';
import { Sheet, Button } from '../ui';
import { formatCurrency } from '../../utils/currency';
import { t } from '../../i18n/es';

interface JobDraftSheetProps {
  open: boolean;
  onClose: () => void;
  clientName: string | undefined;
  title: string;
  estimatedTotal: number;
}

/**
 * Confirma que el JobDraft quedó preparado (ver jobDraftService) sin
 * construir todavía el módulo completo de Órdenes de Trabajo — eso es
 * Fase 3.
 */
export default function JobDraftSheet({
  open,
  onClose,
  clientName,
  title,
  estimatedTotal,
}: JobDraftSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.quotes.jobDraftReady}
      footer={
        <Button fullWidth onClick={onClose}>
          Entendido
        </Button>
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
          <Wrench size={20} className="text-brand-600" />
        </div>
        <p className="text-sm text-slate-600">
          Se preparó un borrador con estos datos para el módulo de Órdenes de Trabajo.
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-500">Cliente</span>
          <span className="font-medium text-slate-900">{clientName ?? '—'}</span>
        </div>
        <div className="flex justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-500">Servicio</span>
          <span className="font-medium text-slate-900 text-right">{title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Total</span>
          <span className="font-semibold text-brand-700">{formatCurrency(estimatedTotal)}</span>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-5 bg-slate-50 rounded-lg px-3 py-2.5">
        {t.quotes.jobDraftMessage}
      </p>
    </Sheet>
  );
}
