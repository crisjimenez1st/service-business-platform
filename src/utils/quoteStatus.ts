import { t } from '../i18n/es';
import type { QuoteStatus } from '../types';

/**
 * Único lugar donde se definen labels y tonos visuales para QuoteStatus
 * — mismo patrón que utils/jobStatus.ts para JobStatus. Se usa siempre
 * sobre el status EFECTIVO (quoteService.getEffectiveStatus), que ya
 * resuelve "expired" dinámicamente antes de llegar aquí.
 */
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: t.quotes.statusDraft,
  sent: t.quotes.statusSent,
  viewed: t.quotes.statusViewed,
  accepted: t.quotes.statusAccepted,
  rejected: t.quotes.statusRejected,
  expired: t.quotes.statusExpired,
  cancelled: t.quotes.statusCancelled,
};

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export const QUOTE_STATUS_TONES: Record<QuoteStatus, BadgeTone> = {
  draft: 'neutral',
  sent: 'info',
  viewed: 'brand',
  accepted: 'success',
  rejected: 'danger',
  expired: 'warning',
  cancelled: 'neutral',
};
