import { getMockTodayJobs } from './mockJobService';
import { getQuotes, getEffectiveStatus } from './quoteService';
import type { MockJob as Job } from '../types';

/**
 * Cada métrica financiera/numérica del dashboard declara explícitamente
 * su procedencia -- nunca un `number` desnudo que podría confundirse
 * con un dato real:
 *   - `{ status: 'real', value }`        -- viene de Supabase (migrado)
 *   - `{ status: 'mock', value }`        -- viene de datos demo/localDb
 *     (entidad todavía no migrada); es un número genuino del mock, no
 *     inventado, pero la UI debe indicar que es demo.
 *   - `{ status: 'unavailable' }`        -- no hay fuente real ni mock
 *     coherente todavía. Nunca se muestra 0 en su lugar.
 */
export type MetricValue =
  | { status: 'real'; value: number }
  | { status: 'mock'; value: number }
  | { status: 'unavailable' };

export interface DashboardMetrics {
  /**
   * ⚠️ unavailable: dependían de Client.totalPaid/pendingBalance,
   * campos derivados que no existen en la tabla real `clients` de
   * Supabase (ver clientMapper.ts) -- vendrían de `jobs`/`payments`
   * reales, que todavía no se migran.
   */
  monthSales: MetricValue;
  pendingCollection: MetricValue;
  /** mock: Jobs todavía sobre localDb -- ver jobService.ts. */
  jobsToday: MetricValue;
  todayJobs: Job[];
  /** real: Quotes migrado a Supabase (ver quoteService.ts) -- ya no es mock. */
  quotesPendingResponse: MetricValue;
  quotesAcceptedThisMonth: MetricValue;
  quotesPendingValue: MetricValue;
}

/**
 * Async ahora que quotesService.getQuotes consulta Supabase. Si la
 * consulta de cotizaciones falla, las 3 métricas de quotes quedan
 * `unavailable` (nunca 0 ni el mock anterior) -- el resto del
 * dashboard (jobsToday, que sigue mock) no se ve afectado por ese
 * fallo, cada fuente se resuelve de forma independiente.
 */
export async function getDashboardMetrics(companyId: string): Promise<DashboardMetrics> {
  const todayJobs = getMockTodayJobs(companyId);

  const quotesResult = await getQuotes(companyId);

  if (quotesResult.error) {
    return {
      monthSales: { status: 'unavailable' },
      pendingCollection: { status: 'unavailable' },
      jobsToday: { status: 'mock', value: todayJobs.length },
      todayJobs,
      quotesPendingResponse: { status: 'unavailable' },
      quotesAcceptedThisMonth: { status: 'unavailable' },
      quotesPendingValue: { status: 'unavailable' },
    };
  }

  const quotes = quotesResult.data;
  const pendingQuotes = quotes.filter((q) => {
    const status = getEffectiveStatus(q);
    return status === 'sent' || status === 'viewed';
  });
  const now = new Date();
  const acceptedThisMonth = quotes.filter((q) => {
    if (q.status !== 'accepted' || !q.acceptedAt) return false;
    const acceptedDate = new Date(q.acceptedAt);
    return acceptedDate.getMonth() === now.getMonth() && acceptedDate.getFullYear() === now.getFullYear();
  });

  return {
    monthSales: { status: 'unavailable' },
    pendingCollection: { status: 'unavailable' },
    jobsToday: { status: 'mock', value: todayJobs.length },
    todayJobs,
    quotesPendingResponse: { status: 'real', value: pendingQuotes.length },
    quotesAcceptedThisMonth: { status: 'real', value: acceptedThisMonth.length },
    quotesPendingValue: { status: 'real', value: pendingQuotes.reduce((sum, q) => sum + q.total, 0) },
  };
}
