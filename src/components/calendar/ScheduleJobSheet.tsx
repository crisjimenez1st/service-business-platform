import { useState } from 'react';
import { Sheet, Button } from '../ui';
import { localDateTimeToTimezoneIso } from '../../utils/timezone';
import { t } from '../../i18n/es';

interface ScheduleJobSheetProps {
  open: boolean;
  onClose: () => void;
  timezone: string;
  currentStartAt: string | undefined;
  currentEndAt: string | undefined;
  isCurrentlyScheduled: boolean;
  onSchedule: (startAtIso: string | null, endAtIso: string | null) => Promise<boolean>;
}

/** Convierte un ISO timestamptz a un valor de <input type="datetime-local">, en la timezone de la empresa -- solo para prellenar el formulario al reprogramar. */
function isoToLocalDateTimeValue(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/**
 * Programa/reprograma/desprograma un Job -- llama exclusivamente a
 * schedule_job (vía jobStore.schedule), única autoridad de
 * scheduled_start_at/scheduled_end_at y de la transición new<->scheduled
 * (migración 009). El frontend NUNCA decide esa transición por su
 * cuenta: solo envía las fechas (o null para desprogramar) y muestra
 * lo que la RPC responda.
 *
 * Corrección de timezone: los <input type="datetime-local"> no llevan
 * zona horaria -- localDateTimeToTimezoneIso interpreta el valor
 * introducido como hora LOCAL de companies.timezone explícitamente,
 * nunca la del navegador del usuario, antes de enviarlo como
 * timestamptz real a la RPC.
 */
export default function ScheduleJobSheet({
  open,
  onClose,
  timezone,
  currentStartAt,
  currentEndAt,
  isCurrentlyScheduled,
  onSchedule,
}: ScheduleJobSheetProps) {
  const [startValue, setStartValue] = useState(currentStartAt ? isoToLocalDateTimeValue(currentStartAt, timezone) : '');
  const [endValue, setEndValue] = useState(currentEndAt ? isoToLocalDateTimeValue(currentEndAt, timezone) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleConfirm() {
    if (!startValue) {
      setError('Selecciona una fecha y hora de inicio.');
      return;
    }
    setSaving(true);
    setError(null);
    const startIso = localDateTimeToTimezoneIso(startValue, timezone);
    const endIso = endValue ? localDateTimeToTimezoneIso(endValue, timezone) : null;
    const ok = await onSchedule(startIso, endIso);
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setError('No pudimos programar el trabajo. Verifica las fechas e intenta de nuevo.');
    }
  }

  async function handleUnschedule() {
    setSaving(true);
    setError(null);
    const ok = await onSchedule(null, null);
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setError('No pudimos desprogramar el trabajo.');
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={isCurrentlyScheduled ? t.calendar.reschedule : t.calendar.schedule}
      footer={
        <div className="flex gap-3">
          {isCurrentlyScheduled && (
            <Button variant="secondary" disabled={saving} onClick={handleUnschedule}>
              {t.calendar.unschedule}
            </Button>
          )}
          <Button fullWidth onClick={handleConfirm} disabled={saving}>
            {saving ? t.common.loading : t.calendar.confirm}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.calendar.startDate}</label>
          <input
            type="datetime-local"
            value={startValue}
            onChange={(e) => setStartValue(e.target.value)}
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.calendar.endDate}</label>
          <input
            type="datetime-local"
            value={endValue}
            onChange={(e) => setEndValue(e.target.value)}
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  );
}
