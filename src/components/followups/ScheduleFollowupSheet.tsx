import { useState } from 'react';
import { Sheet, Button } from '../ui';
import FollowupWhenPicker from '../clients/FollowupWhenPicker';
import { resolveFollowupDate, choiceForMonths, type FollowupChoice } from '../../utils/followupDates';
import { getTodayKeyInTimezone } from '../../utils/timezone';

interface ScheduleFollowupSheetProps {
  open: boolean;
  question: string;
  timezone: string;
  onClose: () => void;
  /** Devuelve true si se guardó el aviso. */
  /** Regla del servicio de la cita: deja la fecha y el motivo ya elegidos. */
  suggestion?: { serviceName: string; months: number; reason: string };
  onSave: (followup: { dueDate: string; reason?: string }) => Promise<boolean>;
}

/** Se muestra al terminar una cita: "¿Cuándo debe volver?". Omitir es válido. Se monta solo cuando hace falta, así cada vez parte limpio. */
export default function ScheduleFollowupSheet({ open, question, timezone, suggestion, onClose, onSave }: ScheduleFollowupSheetProps) {
  const initial = suggestion
    ? choiceForMonths(suggestion.months, getTodayKeyInTimezone(timezone))
    : { choice: 'none' as FollowupChoice, customDate: '' };
  const [choice, setChoice] = useState<FollowupChoice>(initial.choice);
  const [customDate, setCustomDate] = useState(initial.customDate);
  const [reason, setReason] = useState(suggestion?.reason ?? '');
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
      {suggestion && (
        <p className="mb-3 text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
          Sugerido por tu regla: {suggestion.serviceName} vuelve en {suggestion.months === 1 ? '1 mes' : `${suggestion.months} meses`}. Puedes cambiarlo.
        </p>
      )}
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
