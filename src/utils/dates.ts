export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('es-NI', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateShort(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('es-NI', { day: 'numeric', month: 'short' });
}

export function formatRelativeToToday(isoString: string): string {
  if (!isoString) return '—';
  const target = new Date(isoString.slice(0, 10));
  if (Number.isNaN(target.getTime())) return '—';
  const today = new Date(new Date().toISOString().slice(0, 10));
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays === -1) return 'Ayer';
  if (diffDays > 1) return `En ${diffDays} días`;
  return `Hace ${Math.abs(diffDays)} días`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Relativo con granularidad de minutos/horas/días — para eventos puntuales
 * como "vista hace 2 horas" donde formatRelativeToToday (que trunca a
 * día completo) sería demasiado impreciso.
 */
export function formatRelativeTime(isoString: string): string {
  const target = new Date(isoString);
  const diffMs = Date.now() - target.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Hace un momento';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  return formatDate(isoString);
}
