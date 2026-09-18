interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string> {
  options: FilterOption<T>[];
  active: T;
  onChange: (value: T) => void;
}

/**
 * Fila de chips con scroll horizontal propio (overflow-x-auto) para que
 * en pantallas de 320px nunca fuercen overflow horizontal del layout completo.
 * `-mx-4 px-4` extiende el área de scroll hasta el borde en móvil sin
 * romper el padding del contenedor padre.
 */
export default function FilterChips<T extends string>({
  options,
  active,
  onChange,
}: FilterChipsProps<T>) {
  return (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 scrollbar-none">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={active === opt.value}
          className={[
            'shrink-0 min-h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            active === opt.value
              ? 'bg-brand-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
