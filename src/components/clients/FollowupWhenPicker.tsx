import { FOLLOWUP_CHOICES, type FollowupChoice } from '../../utils/followupDates';

interface FollowupWhenPickerProps {
  question: string;
  choice: FollowupChoice;
  onChoice: (choice: FollowupChoice) => void;
  customDate: string;
  onCustomDate: (date: string) => void;
  reason: string;
  onReason: (reason: string) => void;
  /** Hoy en la zona de la empresa (YYYY-MM-DD): mínimo de la fecha libre. */
  minDate: string;
}

const INPUT =
  'w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500';

/** "¿Cuándo debe volver?": chips de un toque + fecha libre + motivo opcional (texto genérico, sin datos clínicos). */
export default function FollowupWhenPicker({
  question,
  choice,
  onChoice,
  customDate,
  onCustomDate,
  reason,
  onReason,
  minDate,
}: FollowupWhenPickerProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">{question}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question}>
        {FOLLOWUP_CHOICES.map((o) => {
          const active = choice === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChoice(o.value)}
              className={[
                'min-h-10 px-3.5 rounded-full text-sm font-medium border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                active
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {choice === 'custom' && (
        <input
          type="date"
          aria-label="Fecha del aviso"
          value={customDate}
          min={minDate}
          onChange={(e) => onCustomDate(e.target.value)}
          className={INPUT}
        />
      )}

      {choice !== 'none' && (
        <input
          type="text"
          aria-label="Motivo (opcional)"
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          placeholder="Motivo (opcional), ej. control, limpieza"
          maxLength={120}
          className={INPUT}
        />
      )}
    </div>
  );
}
