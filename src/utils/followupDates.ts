/**
 * Fechas de seguimiento ("volver en 2 meses"). Todo opera sobre fechas
 * calendario YYYY-MM-DD (sin hora ni zona), partiendo del "hoy" de la
 * empresa -- nunca de UTC ni de la zona del navegador.
 */

export type FollowupChoice = 'none' | '1w' | '1m' | '2m' | '3m' | '6m' | '1y' | 'custom';

export const FOLLOWUP_CHOICES: { value: FollowupChoice; label: string }[] = [
  { value: '1w', label: '1 semana' },
  { value: '1m', label: '1 mes' },
  { value: '2m', label: '2 meses' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '1y', label: '1 año' },
  { value: 'custom', label: 'Otra fecha' },
  { value: 'none', label: 'No necesita' },
];

function parseKey(dateKey: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateKey.split('-').map(Number);
  return { y, m, d };
}

function toKey(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const { y, m, d } = parseKey(dateKey);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Suma meses sin desbordar: 31 ene + 1 mes = 28/29 feb (no 3 mar). */
export function addMonthsToDateKey(dateKey: string, months: number): string {
  const { y, m, d } = parseKey(dateKey);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return toKey(ny, nm, Math.min(d, lastDay));
}

/** Fecha de seguimiento para la opción elegida, o null si no hay (o la fecha libre es inválida o pasada). */
export function resolveFollowupDate(choice: FollowupChoice, customDate: string, todayKey: string): string | null {
  switch (choice) {
    case '1w':
      return addDaysToDateKey(todayKey, 7);
    case '1m':
      return addMonthsToDateKey(todayKey, 1);
    case '2m':
      return addMonthsToDateKey(todayKey, 2);
    case '3m':
      return addMonthsToDateKey(todayKey, 3);
    case '6m':
      return addMonthsToDateKey(todayKey, 6);
    case '1y':
      return addMonthsToDateKey(todayKey, 12);
    case 'custom':
      return /^\d{4}-\d{2}-\d{2}$/.test(customDate) && customDate >= todayKey ? customDate : null;
    default:
      return null;
  }
}
