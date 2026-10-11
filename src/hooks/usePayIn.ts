import { useState } from 'react';
import { useRateInput } from './useRateInput';
import { convertAmount, formatRateDate, rateFactor } from '../utils/exchange';
import { formatCurrency } from '../utils/currency';
import type { CurrencyCode } from '../types';

/**
 * Estado + conversión para cobrar en la otra moneda. Se registra siempre en la
 * moneda de la clínica; el monto entregado y la tasa quedan en la nota.
 */
export function usePayIn(docCurrency: CurrencyCode, balance: number) {
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>(docCurrency);
  const rate = useRateInput();
  const other = payCurrency !== docCurrency;
  const eff = rate.effective;

  function choose(c: CurrencyCode) {
    setPayCurrency(c);
    if (c !== docCurrency && !rate.official && !rate.loading) void rate.fetchRate();
  }

  /** Monto entregado (en payCurrency) → monto en la moneda de la clínica. */
  function toDoc(tendered: number): number | null {
    if (!other) return tendered;
    if (!eff) return null;
    const factor = rateFactor(payCurrency, docCurrency, eff.rate);
    const exact = tendered * factor;
    // Cubrir el saldo completo en la otra moneda no puede ser exacto al centavo.
    if (Math.abs(exact - balance) <= factor * 0.005) return balance;
    return convertAmount(tendered, payCurrency, docCurrency, eff.rate);
  }

  /** Cuánto hay que entregar en payCurrency para saldar `balance`. */
  function fullTendered(): string {
    if (!other || !eff) return String(balance);
    return (Math.ceil(convertAmount(balance, docCurrency, payCurrency, eff.rate) * 100 - 1e-6) / 100).toString();
  }

  function noteSuffix(tendered: number): string | undefined {
    if (!other || !eff) return undefined;
    return `Pagó ${formatCurrency(tendered, payCurrency)} a tasa C$${eff.rate.toFixed(4)} por US$1 (${eff.source === 'bcn' ? 'BCN' : 'manual'} ${formatRateDate(eff.date)})`;
  }

  return { payCurrency, other, choose, rate, eff, toDoc, fullTendered, noteSuffix };
}

