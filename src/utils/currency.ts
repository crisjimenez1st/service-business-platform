import type { CurrencyCode } from '../types';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  NIO: 'C$',
  USD: '$',
};

export function formatCurrency(amount: number, currency: CurrencyCode = 'NIO'): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  // Enteros sin decimales (C$150); con centavos siempre 2 decimales (C$10.50),
  // para que un pago de 10.50 nunca se muestre redondeado a C$11.
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  const formatted = amount.toLocaleString('es-NI', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${symbol}${formatted}`;
}
