import { useState } from 'react';
import { Sheet, Button } from '../ui';
import FollowupWhenPicker from '../clients/FollowupWhenPicker';
import { resolveFollowupDate, type FollowupChoice } from '../../utils/followupDates';
import { getTodayKeyInTimezone } from '../../utils/timezone';

interface ScheduleFollowupSheetProps {
  open: boolean;
  question: string;
  timezone: string;
  onClose: () => void;
  /** Devuelve true si se guardó el aviso. */
  onSave: (followup: { dueDate: string; reason?: string }) => Promise<boolean>;
}

/** Se muestra al terminar una cita: "¿Cuándo debe volver?". Omitir es válido. Se monta solo cuando hace falta, así cada vez parte limpio. */
export default function ScheduleFollowupSheet({ open, question, timezone, onClose, onSave }: ScheduleFollowupSheetProps) {
  const [choice, setChoice] = useState<FollowupChoice>('none');
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayKey = getTodayKeyInTimezone(timezone);
  const dueDate = resolveFollowupDate(choice, customDate, todayKey);

  async function handleSave() {
    if (!dueDate) {
      setError(choice === 'custom' ? 'Elige una fecha de hoy en adelante.' : 'Elige cuándo debe volver, o toca Omitir.');
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await onSave({ dueDate, reason: reason.trim() || undefined });
    setSaving(false);
    if (ok) onClose();
    else setError('No pudimos guardar el aviso. Intenta de nuevo.');
  }

  return (
    <Sheet
      open={open}
      onClose={() => !saving && onClose()}
      title="Cita terminada"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Omitir
          </Button>
          <Button fullWidth onClick={handleSave} disabled={saving || choice === 'none'}>
            {saving ? 'Guardando...' : 'Guardar aviso'}
          </Button>
        </div>
      }
    >
      <FollowupWhenPicker
        question={question}
        choice={choice}
        onChoice={setChoice}
        customDate={customDate}
        onCustomDate={setCustomDate}
        reason={reason}
        onReason={setReason}
        minDate={todayKey}
      />
      {error && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
    </Sheet>
  );
}
