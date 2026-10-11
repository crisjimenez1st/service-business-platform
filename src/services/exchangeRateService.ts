import { fail, ok, type ServiceResult } from './errors/serviceError';
import type { ExchangeRate } from '../utils/exchange';

const UNAVAILABLE = 'No pudimos obtener la tasa del Banco Central. Puedes escribirla tú.';

/** Tasa oficial del BCN del día, vía la función de Netlify (el navegador no puede llamar al BCN directo). */
export async function getOfficialRate(): Promise<ServiceResult<ExchangeRate>> {
  try {
    const res = await fetch('/.netlify/functions/bcn-rate', { headers: { Accept: 'application/json' } });
    if (!res.ok) return fail({ kind: 'network', message: UNAVAILABLE });
    const json = (await res.json()) as { rate?: unknown; date?: unknown };
    const rate = Number(json.rate);
    if (!Number.isFinite(rate) || rate < 10 || rate > 200 || typeof json.date !== 'string') {
      return fail({ kind: 'network', message: UNAVAILABLE });
    }
    return ok({ rate, date: json.date, source: 'bcn' });
  } catch {
    return fail({ kind: 'network', message: UNAVAILABLE });
  }
}
