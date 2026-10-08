/**
 * Cumpleaños. Todo con fechas calendario YYYY-MM-DD y el "hoy" de la clínica
 * (nunca UTC ni la zona del navegador). Quien nació un 29 de febrero se
 * celebra el 28 en los años no bisiestos.
 */

function parse(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function dayNumber(y: number, m: number, d: number): number {
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function occurrence(year: number, m: number, d: number): number {
  const day = m === 2 && d === 29 && !isLeap(year) ? 28 : d;
  return dayNumber(year, m, day);
}

export interface NextBirthday {
  /** 0 = hoy. */
  daysUntil: number;
  /** Edad que cumple en esa fecha. */
  turning: number;
}

export function nextBirthday(birthDate: string, todayKey: string): NextBirthday | null {
  const b = parse(birthDate);
  const t = parse(todayKey);
  if (!b.y || !b.m || !b.d || !t.y) return null;
  const today = dayNumber(t.y, t.m, t.d);
  let year = t.y;
  let target = occurrence(year, b.m, b.d);
  if (target < today) {
    year += 1;
    target = occurrence(year, b.m, b.d);
  }
  return { daysUntil: target - today, turning: year - b.y };
}
