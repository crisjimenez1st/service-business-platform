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
          className="min-w-11 min-h-11 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm transition-colors hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ChevronLeft size={24} />
        </button>
        <Button variant="secondary" onClick={onToday} className="!bg-white border border-slate-200 shadow-sm hover:!bg-brand-50 hover:!text-brand-700 font-semibold">
          {t.calendar.today}
        </Button>
        <button
          onClick={onNext}
          aria-label="Siguiente"
          className="min-w-11 min-h-11 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm transition-colors hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ChevronRight size={24} />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 ml-2 font-brand">{rangeLabel.replace(/^./, (c) => c.toUpperCase()).replace(" de ", " ")}</h2>
      </div>

      {!hideViewSwitcher && (
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1.5">
          {(['month', 'week', 'day'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={[
                'px-4 py-2 min-h-10 text-sm sm:text-base font-semibold rounded-xl transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                viewMode === mode ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-brand-700 hover:bg-white/70',
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
