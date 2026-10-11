import type { CurrencyCode } from '../types';

/** Tasa oficial: córdobas por 1 dólar. */
export interface ExchangeRate {
  rate: number;
  /** Fecha (YYYY-MM-DD) a la que corresponde la tasa. */
  date: string;
  source: 'bcn' | 'manual';
}

/** Convierte un monto entre NIO y USD con la tasa (C$ por US$). */
export function convertAmount(amount: number, from: CurrencyCode, to: CurrencyCode, rate: number): number {
  if (from === to) return amount;
  if (from === 'USD') return Math.round(amount * rate * 100) / 100;
  return Math.round((amount / rate) * 100) / 100;
}

/** Cuántas unidades de `to` vale 1 unidad de `from`. */
export function rateFactor(from: CurrencyCode, to: CurrencyCode, rate: number): number {
  if (from === to) return 1;
  return from === 'USD' ? rate : 1 / rate;
}

export function otherCurrency(c: CurrencyCode): CurrencyCode {
  return c === 'USD' ? 'NIO' : 'USD';
}

export function formatRateDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
