import { useCallback } from 'react';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { formatCurrency } from '../utils/currency';
import type { CurrencyCode } from '../types';

/**
 * Formateador de dinero en la moneda por defecto del negocio. Para
 * montos que no traen moneda propia (oportunidades, ventas del mes,
 * saldos). Un Job, un pago o una cotización usan SU moneda guardada,
 * no esta.
 */
export function useMoney(): (amount: number) => string {
  const { company } = useCurrentCompany();
  const currency: CurrencyCode = company?.currency === 'USD' ? 'USD' : 'NIO';
  return useCallback((amount: number) => formatCurrency(amount, currency), [currency]);
}
