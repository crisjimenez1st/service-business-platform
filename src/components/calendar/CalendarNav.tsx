import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui';
import { t } from '../../i18n/es';

export type CalendarViewMode = 'month' | 'week' | 'day';

interface CalendarNavProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  rangeLabel: string;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
  /** Oculta el selector Mes/Semana/Día -- usado por la agenda de técnico, que solo navega por día. */
  hideViewSwitcher?: boolean;
}

export default function CalendarNav({
  viewMode,
  onViewModeChange,
  rangeLabel,
  onPrevious,
  onToday,
  onNext,
  hideViewSwitcher,
}: CalendarNavProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevious}
          aria-label="Anterior"
          className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ChevronLeft size={18} />
        </button>
        <Button variant="secondary" size="sm" onClick={onToday}>
          {t.calendar.today}
        </Button>
        <button
          onClick={onNext}
          aria-label="Siguiente"
          className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ChevronRight size={18} />
        </button>
        <h2 className="text-base sm:text-lg font-semibold text-slate-900 capitalize ml-1">{rangeLabel}</h2>
      </div>

      {!hideViewSwitcher && (
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(['month', 'week', 'day'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={[
                'px-3 py-1.5 min-h-8 text-sm font-medium rounded-lg transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                viewMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {mode === 'month' ? t.calendar.month : mode === 'week' ? t.calendar.week : t.calendar.day}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
