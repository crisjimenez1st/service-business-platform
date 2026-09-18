/**
 * Helpers para generar fechas demo relativas a "hoy".
 * Así los datos semilla (ej. "hace 6 meses") siempre tienen sentido,
 * sin importar cuándo se ejecute o revise el proyecto.
 */

export function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

export function monthsFromNow(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export function todayAt(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function isoDateOnly(isoString: string): string {
  return isoString.slice(0, 10);
}
