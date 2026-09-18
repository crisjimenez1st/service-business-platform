import { useState } from 'react';
import { User } from 'lucide-react';
import { Sheet, Button } from '../ui';
import type { CompanyTechnician } from '../../types';
import { t } from '../../i18n/es';

interface AssignTechnicianSheetProps {
  open: boolean;
  onClose: () => void;
  technicians: CompanyTechnician[];
  currentTechnicianId: string | undefined;
  onAssign: (technicianId: string | null) => Promise<boolean>;
}

/**
 * Selector de técnico -- llama exclusivamente a assign_job_technician
 * (vía jobStore.assignTechnician, que a su vez llama a jobService).
 * Nunca hace UPDATE directo sobre jobs. El nombre mostrado viene de
 * get_company_technicians() (migración 010) -- nunca un UUID crudo.
 */
export default function AssignTechnicianSheet({
  open,
  onClose,
  technicians,
  currentTechnicianId,
  onAssign,
}: AssignTechnicianSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(currentTechnicianId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const ok = await onAssign(selectedId);
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setError('No pudimos actualizar la asignación. Intenta de nuevo.');
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={t.calendar.assignTechnician}
      footer={
        <Button fullWidth onClick={handleConfirm} disabled={saving}>
          {saving ? t.common.loading : t.calendar.confirm}
        </Button>
      }
    >
      <div className="space-y-1">
        <button
          onClick={() => setSelectedId(null)}
          className={[
            'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-11 text-left transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            selectedId === null ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50',
          ].join(' ')}
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User size={14} className="text-slate-400" />
          </div>
          <span className="text-sm font-medium">{t.calendar.unassigned}</span>
        </button>

        {technicians.length === 0 && (
          <p className="text-sm text-slate-500 px-3 py-4">{t.calendar.noTechnicians}</p>
        )}

        {technicians.map((tech) => (
          <button
            key={tech.userId}
            onClick={() => setSelectedId(tech.userId)}
            className={[
              'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-11 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              selectedId === tech.userId ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0 text-brand-700 text-xs font-semibold">
              {tech.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{tech.displayName}</p>
              {tech.email && tech.email !== tech.displayName && (
                <p className="text-xs text-slate-500 truncate">{tech.email}</p>
              )}
            </div>
          </button>
        ))}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">{error}</p>}
      </div>
    </Sheet>
  );
}
