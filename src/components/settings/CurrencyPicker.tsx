import type { CurrencyCode } from '../../types';

const OPTIONS: { value: CurrencyCode; label: string; hint: string }[] = [
  { value: 'NIO', label: 'Córdobas', hint: 'C$' },
  { value: 'USD', label: 'Dólares', hint: 'US$' },
];

interface CurrencyPickerProps {
  value: CurrencyCode;
  onChange: (value: CurrencyCode) => void;
  disabled?: boolean;
}

/** Moneda por defecto del negocio: córdobas o dólares. */
export default function CurrencyPicker({ value, onChange, disabled }: CurrencyPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Moneda">
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={[
              'rounded-2xl border px-4 py-3 text-left min-h-14 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              active ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 bg-white hover:bg-slate-50',
            ].join(' ')}
          >
            <span className="font-semibold text-slate-900">{o.label}</span>
            <span className="ml-2 text-sm text-slate-500">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
