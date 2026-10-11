import { INPUT_CLASS } from './inputClasses';
import { formatRateDate, type ExchangeRate } from '../../utils/exchange';

interface RateFieldProps {
  loading: boolean;
  error: string | null;
  official: ExchangeRate | null;
  manual: string;
  onManual: (v: string) => void;
  onRetry: () => void;
}

/** Muestra la tasa oficial del BCN y deja corregirla a mano si no cargó. */
export default function RateField({ loading, error, official, manual, onManual, onRetry }: RateFieldProps) {
  return (
    <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm space-y-2">
      {loading && <p className="text-slate-600">Consultando la tasa oficial del Banco Central…</p>}
      {official && !loading && (
        <p className="text-slate-700">
          Tasa oficial BCN del {formatRateDate(official.date)}:{' '}
          <span className="font-semibold text-slate-900">C${official.rate.toFixed(4)}</span> por US$1
        </p>
      )}
      {error && !loading && (
        <p className="text-slate-700">
          {error}{' '}
          <button type="button" onClick={onRetry} className="font-medium text-brand-700 underline">
            Buscar de nuevo
          </button>
        </p>
      )}
      {(error || official) && !loading && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            {official ? 'Usar otra tasa (opcional)' : 'Tasa de hoy (C$ por US$1)'}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={manual}
            onChange={(e) => onManual(e.target.value)}
            placeholder="36.6243"
            className={INPUT_CLASS}
          />
        </div>
      )}
    </div>
  );
}
