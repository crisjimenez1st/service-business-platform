import { Stethoscope, Smile, Wrench, Briefcase, type LucideIcon } from 'lucide-react';
import { BUSINESS_TYPE_OPTIONS } from '../../i18n/businessTerms';
import type { BusinessType } from '../../types';

const ICONS: Record<BusinessType, LucideIcon> = {
  dental: Smile,
  medical: Stethoscope,
  technical_services: Wrench,
  other: Briefcase,
};

interface BusinessTypePickerProps {
  value: BusinessType | null;
  onChange: (value: BusinessType) => void;
  disabled?: boolean;
  /** Si se indica, solo se muestran estos tipos. */
  allowed?: BusinessType[];
}

/** Cuatro tarjetas grandes para elegir el tipo de negocio. Solo cambia el vocabulario y el menú. */
export default function BusinessTypePicker({ value, onChange, disabled, allowed }: BusinessTypePickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de negocio">
      {BUSINESS_TYPE_OPTIONS.filter((o) => !allowed || allowed.includes(o.value)).map((o) => {
        const Icon = ICONS[o.value];
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
              'text-left rounded-2xl border p-4 transition-colors min-h-24',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              active ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 bg-white hover:bg-slate-50',
            ].join(' ')}
          >
            <Icon size={22} className={active ? 'text-brand-600' : 'text-slate-500'} />
            <p className="font-semibold text-slate-900 mt-2">{o.label}</p>
            <p className="text-sm text-slate-500 mt-0.5">{o.description}</p>
          </button>
        );
      })}
    </div>
  );
}
