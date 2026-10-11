import RateField from './RateField';
import { INPUT_CLASS } from './inputClasses';
import { otherCurrency } from '../../utils/exchange';
import type { usePayIn } from '../../hooks/usePayIn';
import type { CurrencyCode } from '../../types';

const LABEL: Record<CurrencyCode, string> = { NIO: 'Córdobas (C$)', USD: 'Dólares (US$)' };

interface Props {
  docCurrency: CurrencyCode;
  state: ReturnType<typeof usePayIn>;
}

/** Selector "¿En qué moneda pagó?" y tasa del día cuando es la otra moneda. */
export default function PayInField({ docCurrency, state }: Props) {
  const { payCurrency, choose, rate, other } = state;
  const options: CurrencyCode[] = [docCurrency, otherCurrency(docCurrency)];
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">¿En qué moneda pagó?</label>
        <select value={payCurrency} onChange={(e) => choose(e.target.value as CurrencyCode)} className={INPUT_CLASS}>
          {options.map((c) => (
            <option key={c} value={c}>
              {LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      {other && (
        <>
          <RateField
            loading={rate.loading}
            error={rate.error}
            official={rate.official}
            manual={rate.manual}
            onManual={rate.setManual}
            onRetry={rate.fetchRate}
          />
          <p className="text-xs text-slate-500">
            El pago se registra en {docCurrency === 'NIO' ? 'córdobas' : 'dólares'}, la moneda de tu clínica.
          </p>
        </>
      )}
    </div>
  );
}
