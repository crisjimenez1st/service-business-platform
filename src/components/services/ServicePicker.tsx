import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { INPUT_CLASS } from '../payments/inputClasses';
import { normalizeServiceKey } from '../../services/serviceRulesService';
import { formatCurrency } from '../../utils/currency';
import type { ClinicService, CurrencyCode } from '../../types';

interface ServicePickerProps {
  services: ClinicService[];
  currency: CurrencyCode;
  selectedName?: string;
  onPick: (service: ClinicService) => void;
}

/** Buscador de servicios del catálogo: escribes y filtra por nombre o tipo de tratamiento; al tocar uno, se elige. */
export default function ServicePicker({ services, currency, selectedName, onPick }: ServicePickerProps) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = normalizeServiceKey(query);
    return services
      .filter((s) => !q || normalizeServiceKey(s.name).includes(q) || normalizeServiceKey(s.category ?? '').includes(q))
      .slice(0, 30);
  }, [services, query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar servicio o tipo de tratamiento"
          aria-label="Buscar servicio"
          className={`${INPUT_CLASS} pl-9`}
        />
      </div>
      <ul className="max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {matches.length === 0 ? (
          <li className="px-3 py-2.5 text-sm text-slate-500">Sin resultados.</li>
        ) : (
          matches.map((s) => {
            const selected = selectedName !== undefined && normalizeServiceKey(selectedName) === normalizeServiceKey(s.name);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  aria-pressed={selected}
                  className={[
                    'w-full text-left px-3 py-2.5 min-h-11 text-sm flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:bg-slate-50',
                    selected ? 'bg-brand-50' : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900 truncate">{s.name}</span>
                    {s.category && <span className="block text-xs text-slate-500 truncate">{s.category}</span>}
                  </span>
                  {s.price !== undefined && (
                    <span className="shrink-0 font-semibold text-brand-700">{formatCurrency(s.price, currency)}</span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
