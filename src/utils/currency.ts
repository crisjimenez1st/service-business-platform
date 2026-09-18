import type { CurrencyCode } from '../types';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  NIO: 'C$',
  USD: '$',
};

export function formatCurrency(amount: number, currency: CurrencyCode = 'NIO'): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = amount.toLocaleString('es-NI', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${symbol}${formatted}`;
}
