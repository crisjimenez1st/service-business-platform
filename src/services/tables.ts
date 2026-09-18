/**
 * Nombres de "tabla" centralizados — evita strings mágicos repetidos.
 * ⚠️ `quotes` y `jobDrafts` NO están en esta lista: ambas entidades
 * viven exclusivamente en Supabase (ver quoteService.ts/
 * jobDraftService.ts), sin ningún dato correspondiente en localDb.
 */
export const TABLES = {
  companies: 'companies',
  users: 'users',
  clients: 'clients',
  equipment: 'equipment',
  warranties: 'warranties',
  jobs: 'jobs',
  opportunities: 'opportunities',
  payments: 'payments',
  notifications: 'notifications',
} as const;
