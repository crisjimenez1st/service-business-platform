import type { MetricValue } from '../services/dashboardService';
import { t } from '../i18n/es';

export interface RenderedMetric {
  display: string;
  /** Presente solo cuando la métrica es de origen mock/demo -- nunca para 'real' ni 'unavailable'. */
  badge?: string;
}

/**
 * Traduce un MetricValue (real/mock/unavailable) a lo que MetricCard
 * necesita mostrar. Única función que decide el texto "—" para datos
 * no disponibles y la insignia "Demo" para datos mock -- si el
 * criterio cambia, se ajusta aquí una sola vez.
 *
 * `formatter` por defecto es identidad (para conteos simples como
 * "8"); pasar `formatCurrency` para métricas monetarias.
 */
export function renderMetric(
  metric: MetricValue,
  formatter: (value: number) => string = String
): RenderedMetric {
  if (metric.status === 'unavailable') {
    return { display: t.dashboard.unavailable };
  }
  if (metric.status === 'mock') {
    return { display: formatter(metric.value), badge: t.dashboard.mockDataBadge };
  }
  return { display: formatter(metric.value) };
}
