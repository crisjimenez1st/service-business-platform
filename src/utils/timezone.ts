/**
 * Utilidades de timezone para el calendario (Fase 3, Bloque 4).
 *
 * Postgres almacena scheduled_start_at/scheduled_end_at como
 * timestamptz (UTC internamente) -- correcto, no se toca. El problema
 * que este archivo resuelve es de PRESENTACIÓN: agrupar un Job por
 * día, o mostrarle al usuario "10:00 AM", usando UTC directamente
 * (ej. `date.toISOString().slice(0, 10)`) puede colocar una cita en el
 * día o la hora incorrectos si la empresa está en una zona horaria
 * distinta a UTC -- Nicaragua es UTC-6, así que un Job a las 20:00
 * hora local del 15 de septiembre es 02:00 UTC del 16 -- agruparlo por
 * la fecha UTC lo pondría equivocadamente en el día siguiente.
 *
 * Se usa Intl.DateTimeFormat con IANA timezone (soportado nativamente
 * por todos los navegadores modernos, sin librería externa) en vez de
 * aritmética manual de offsets -- maneja correctamente horario de
 * verano si algún día aplica, y es el mecanismo estándar de JS para
 * esto.
 */

/** Los 3 componentes de fecha (año, mes, día) de un instante, interpretados en la timezone dada -- no en UTC ni en la timezone del navegador del usuario. */
export function getDatePartsInTimezone(
  isoString: string,
  timezone: string
): { year: number; month: number; day: number } {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day };
}

/** Clave de agrupación por día ("2026-09-15"), calculada en la timezone de la empresa -- reemplaza a toISOString().slice(0,10), que usa UTC. */
export function getDayKeyInTimezone(isoString: string, timezone: string): string {
  const { year, month, day } = getDatePartsInTimezone(isoString, timezone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Hora local formateada ("2:30 PM"), en la timezone de la empresa. */
export function formatTimeInTimezone(isoString: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

/** Fecha larga en español ("lunes, 15 de septiembre de 2026"), en la timezone de la empresa. */
export function formatLongDateInTimezone(isoString: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoString));
}

/** Fecha corta ("15 sep"), en la timezone de la empresa -- para headers de columna en Week/celdas de Month. */
export function formatShortDateInTimezone(isoString: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
  }).format(new Date(isoString));
}

/**
 * La hora local (0-23) de un instante en la timezone dada -- usado por
 * WeekView/DayView para posicionar un Job en su franja horaria
 * correcta, y para decidir si el rango visual 7:00-20:00 necesita
 * ampliarse (ver expandHourRangeForJobs más abajo).
 */
export function getLocalHourInTimezone(isoString: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date(isoString));
  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const hour = Number(hourPart);
  return hour === 24 ? 0 : hour;
}

/**
 * Convierte un valor de <input type="datetime-local"> (ej.
 * "2026-09-20T14:00", SIN zona horaria) a un timestamptz ISO real,
 * interpretando esa fecha/hora como hora LOCAL de `timezone` -- nunca
 * la del navegador del usuario, que puede ser distinta de
 * companies.timezone (ej. un owner viendo el calendario desde otro
 * país). Es la corrección explícita pedida para ScheduleJobSheet: sin
 * esto, `new Date(localDateTimeString)` interpretaría el valor en la
 * zona del navegador, produciendo el timestamptz equivocado si esa
 * zona no coincide con la de la empresa.
 *
 * Método: se calcula el offset real de `timezone` en el instante
 * aproximado (tratando el string como si ya fuera UTC), y se corrige
 * una vez -- suficiente porque el offset de una zona horaria es
 * estable dentro de una ventana de pocas horas (el único caso donde
 * cambiaría sería un cambio de horario de verano ocurriendo
 * exactamente en esa hora, un caso extremo que no aplica a Nicaragua).
 */
export function localDateTimeToTimezoneIso(localDateTimeValue: string, timezone: string): string {
  // Paso 1: interpretar el string como si fuera UTC, para tener un
  // punto de partida sobre el que medir el offset real de `timezone`.
  const asIfUtc = new Date(localDateTimeValue + ':00Z');

  // Paso 2: ¿qué hora marca `timezone` en ese instante? La diferencia
  // entre esa hora y la hora que el usuario escribió es el offset real
  // que hay que restar.
  const partsInTz = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(asIfUtc);

  const get = (type: string) => partsInTz.find((p) => p.type === type)?.value ?? '0';
  const tzAsUtcMs = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')) === 24 ? 0 : Number(get('hour')),
    Number(get('minute'))
  );

  // Paso 3: la diferencia entre "lo que el usuario escribió, tratado
  // como UTC" y "lo que timezone realmente marca en ese instante" es
  // el offset -- se resta de asIfUtc para obtener el instante UTC real
  // que corresponde a esa hora local.
  const offsetMs = tzAsUtcMs - asIfUtc.getTime();
  const realUtcMs = asIfUtc.getTime() - offsetMs;

  return new Date(realUtcMs).toISOString();
}

/**
 * Dado un conjunto de Jobs y un rango base [baseStartHour, baseEndHour),
 * calcula el rango de horas que realmente hay que mostrar en
 * Week/DayView -- nunca más angosto que el rango base, pero se amplía
 * si algún Job cae antes o después. Esto garantiza que ningún Job
 * válido desaparezca silenciosamente por quedar fuera de la franja
 * visual 7:00-20:00 por defecto.
 */
export function expandHourRangeForJobs(
  jobs: { scheduledStartAt?: string; scheduledEndAt?: string }[],
  timezone: string,
  baseStartHour = 7,
  baseEndHour = 20
): { startHour: number; endHour: number } {
  let startHour = baseStartHour;
  let endHour = baseEndHour;

  for (const job of jobs) {
    if (job.scheduledStartAt) {
      const hour = getLocalHourInTimezone(job.scheduledStartAt, timezone);
      if (hour < startHour) startHour = hour;
    }
    if (job.scheduledEndAt) {
      const hour = getLocalHourInTimezone(job.scheduledEndAt, timezone);
      const neededEnd = hour + 1;
      if (neededEnd > endHour) endHour = neededEnd;
    }
  }

  return { startHour, endHour };
}

/** Lunes (00:00 hora local del navegador) de la semana calendario que contiene `date` -- usado para calcular rangos de Month/Week, no para presentación (esa siempre pasa por *InTimezone). */
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Label del mes visible ("septiembre de 2026"), en la timezone de la empresa. Vive aquí (no en MonthView.tsx) para que ese archivo solo exporte el componente -- ver regla only-export-components. */
export function getMonthRangeLabel(anchorDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat('es-NI', { timeZone: timezone, month: 'long', year: 'numeric' }).format(anchorDate);
}

/** Label del rango de semana ("15 sep – 21 sep"), en la timezone de la empresa. Vive aquí por el mismo motivo que getMonthRangeLabel. */
export function getWeekRangeLabel(anchorDate: Date, timezone: string): string {
  const weekStart = startOfWeekMonday(anchorDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return `${formatShortDateInTimezone(weekStart.toISOString(), timezone)} – ${formatShortDateInTimezone(weekEnd.toISOString(), timezone)}`;
}
