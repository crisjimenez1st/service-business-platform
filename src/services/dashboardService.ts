import { getMockTodayJobs } from './mockJobService';
import { getQuotes, getEffectiveStatus } from './quoteService';
import { getReceivablesSummary } from './paymentService';
import type { MockJob as Job, ReceivablesSummary } from '../types';

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
   * ⚠️ unavailable: depende de ingresos cobrados por periodo, que
   * todavía no se calculan (Bloque 9, Dashboard gerencial).
   */
  monthSales: MetricValue;
  /**
   * real: get_receivables_summary (migración 013) -- una entrada por
   * moneda, nunca sumadas entre sí. `null` = no se pudo consultar
   * (nunca se muestra 0 en su lugar).
   */
  receivables: ReceivablesSummary[] | null;
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
export async function getDashboardMetrics(companyId: string, companyCurrency: string = 'NIO'): Promise<DashboardMetrics> {
  const todayJobs = getMockTodayJobs(companyId);

  // Cada fuente se resuelve de forma independiente: si una falla, solo
  // sus métricas quedan unavailable.
  const [quotesResult, receivablesResult] = await Promise.all([
    getQuotes(companyId),
    getReceivablesSummary(companyId),
  ]);
  const receivables = receivablesResult.error ? null : receivablesResult.data;

  if (quotesResult.error) {
    return {
      monthSales: { status: 'unavailable' },
      receivables,
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
    receivables,
    jobsToday: { status: 'mock', value: todayJobs.length },
    todayJobs,
    quotesPendingResponse: { status: 'real', value: pendingQuotes.length },
    quotesAcceptedThisMonth: { status: 'real', value: acceptedThisMonth.length },
    // Solo cotizaciones en la moneda del negocio: nunca se suman monedas distintas.
    quotesPendingValue: {
      status: 'real',
      value: pendingQuotes.filter((q) => q.currency === companyCurrency).reduce((sum, q) => sum + q.total, 0),
    },
  };
}
