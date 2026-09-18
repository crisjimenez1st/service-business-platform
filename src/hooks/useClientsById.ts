import { useEffect, useMemo } from 'react';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientStore } from '../store/clientStore';
import type { Client } from '../types';
import type { ServiceError } from '../services/errors/serviceError';

interface UseClientsByIdResult {
  clients: Client[];
  clientsById: Record<string, Client>;
  loading: boolean;
  error: ServiceError | null;
  /** Vuelve a consultar Supabase -- para el botón "Reintentar" en la UI. */
  refetch: () => void;
}

/**
 * Carga los clientes de la empresa activa (vía clientStore, que ya
 * expone loading/error propios -- ver store/clientStore.ts) e indexa
 * por id, para que los componentes de lista (jobs, opportunities,
 * cotizaciones) puedan resolver `clientsById[clientId]` en O(1) en vez
 * de un `.find()` por card.
 *
 * El fetch real ocurre dentro de clientStore.load() (una acción de
 * Zustand), no en el cuerpo de este useEffect -- este solo dispara la
 * acción cuando cambia companyId. Mismo patrón que
 * OpportunitiesPage/QuotesPage usan con sus respectivos stores.
 */
export function useClientsById(): UseClientsByIdResult {
  const { company } = useCurrentCompany();
  const companyId = company?.id;

  const clients = useClientStore((s) => s.clients);
  const loading = useClientStore((s) => s.loading);
  const error = useClientStore((s) => s.error);
  const load = useClientStore((s) => s.load);

  useEffect(() => {
    if (companyId) load(companyId);
  }, [companyId, load]);

  const clientsById = useMemo(() => {
    const map: Record<string, Client> = {};
    clients.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [clients]);

  return {
    clients,
    clientsById,
    loading,
    error,
    refetch: () => companyId && load(companyId),
  };
}
