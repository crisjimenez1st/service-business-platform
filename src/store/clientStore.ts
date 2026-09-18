import { create } from 'zustand';
import type { Client } from '../types';
import * as clientService from '../services/clientService';
import type { ClientDomainInput } from '../services/mappers/clientMapper';
import type { ServiceError } from '../services/errors/serviceError';

interface ClientState {
  clients: Client[];
  companyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  load: (companyId: string) => Promise<void>;
  createClient: (input: ClientDomainInput) => Promise<Client | null>;
  updateClient: (id: string, patch: Partial<ClientDomainInput>) => Promise<Client | null>;
  deleteClient: (id: string) => Promise<boolean>;
}

/**
 * Store de clientes -- mismo patrón que opportunityStore/quoteStore
 * (companyId interno fijado en `load`, cada mutación lo revalida antes
 * de tocar el estado local), pero con loading/error explícitos porque
 * clientService ya es async (consulta Supabase) a diferencia de
 * opportunityService/localDb, que son síncronos.
 *
 * Este store es la forma correcta de resolver "fetch en un efecto de
 * página" sin que el linter marque set-state-in-effect: el setState
 * ocurre DENTRO de las acciones del store (Zustand), no en el cuerpo
 * de un useEffect de componente -- mismo patrón ya establecido por
 * opportunityStore/quoteStore para sus propias cargas.
 *
 * AISLAMIENTO POR EMPRESA (regla añadida tras la migración de
 * Clients): si `load` se llama con un `companyId` distinto al que ya
 * está en el store, `clients`/`error` se limpian INMEDIATAMENTE
 * (antes de esperar la respuesta de red) para que la UI nunca muestre,
 * ni por un instante, la lista de la empresa anterior mientras carga
 * la nueva. No hay todavía selector multiempresa en la UI, pero el
 * store ya es seguro para cuando lo haya.
 *
 * `loadToken` protege además contra una condición de carrera real: si
 * `load(A)` está en curso y se llama `load(B)` antes de que A resuelva,
 * la respuesta tardía de A no debe pisar los datos de B cuando por fin
 * llegue -- cada llamada a `load` incrementa el token y solo aplica su
 * resultado si sigue siendo la llamada más reciente.
 *
 * Actualización optimista solo si el servicio confirma éxito (nunca si
 * devuelve error) -- mismo criterio que el resto de stores de la app.
 */
let loadToken = 0;

export const useClientStore = create<ClientState>((set, get) => ({
  clients: [],
  companyId: null,
  loading: false,
  error: null,

  load: async (companyId: string) => {
    const myToken = ++loadToken;
    const isCompanyChange = get().companyId !== companyId;

    // Invalida de inmediato si cambia la empresa activa -- nunca dejar
    // en pantalla, ni un instante, la lista de la empresa anterior.
    if (isCompanyChange) {
      set({ clients: [], error: null, companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }

    const result = await clientService.getClients(companyId);
    if (myToken !== loadToken) return; // una llamada más nueva ya tomó el control

    if (result.error) {
      set({ clients: [], error: result.error, loading: false });
    } else {
      set({ clients: result.data, loading: false });
    }
  },

  createClient: async (input: ClientDomainInput) => {
    const { companyId } = get();
    if (!companyId) return null;
    const result = await clientService.createClient(companyId, input);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({ clients: [...get().clients, result.data], error: null });
    return result.data;
  },

  updateClient: async (id: string, patch: Partial<ClientDomainInput>) => {
    const { companyId } = get();
    if (!companyId) return null;
    const result = await clientService.updateClient(id, companyId, patch);
    if (result.error) {
      set({ error: result.error });
      return null;
    }
    set({
      clients: get().clients.map((c) => (c.id === id ? result.data : c)),
      error: null,
    });
    return result.data;
  },

  deleteClient: async (id: string) => {
    const { companyId } = get();
    if (!companyId) return false;
    const result = await clientService.deleteClient(id, companyId);
    if (result.error) {
      set({ error: result.error });
      return false;
    }
    set({ clients: get().clients.filter((c) => c.id !== id), error: null });
    return true;
  },
}));

// ============================================================
// Carga de UN cliente por id (detalle) -- store separado porque su
// forma de estado (un registro + su propio loading/error) es distinta
// de la lista de arriba, y mezclar ambos ciclos de vida en un mismo
// store complicaría innecesariamente los selectores.
// ============================================================

interface SingleClientState {
  client: Client | null;
  companyId: string | null;
  loading: boolean;
  error: ServiceError | null;
  /** Carga el cliente `id` de la empresa `companyId`. Idempotente: llamar de nuevo simplemente vuelve a consultar. */
  load: (id: string, companyId: string) => Promise<void>;
  /** Reemplaza el cliente en memoria con uno ya resuelto (ej. tras editar exitosamente) sin volver a consultar Supabase. */
  setClient: (client: Client) => void;
}

let singleLoadToken = 0;

/**
 * Store dedicado a "un cliente por id" (ClientProfilePage,
 * QuoteDetailPage). El setState vive aquí (acción de Zustand), no en
 * el cuerpo de un useEffect de componente -- ver nota extensa en
 * useClientStore arriba sobre por qué esto evita
 * react/set-state-in-effect sin sacrificar el manejo de loading/error.
 *
 * Mismo aislamiento por empresa que useClientStore: si `load` se llama
 * con un `companyId` distinto al almacenado, `client`/`error` se
 * limpian antes de esperar la respuesta -- evita mostrar el perfil de
 * un cliente que en realidad pertenece a la empresa anterior.
 */
export const useSingleClientStore = create<SingleClientState>((set, get) => ({
  client: null,
  companyId: null,
  loading: false,
  error: null,

  load: async (id: string, companyId: string) => {
    const myToken = ++singleLoadToken;
    const isCompanyChange = get().companyId !== companyId;

    if (isCompanyChange) {
      set({ client: null, error: null, companyId, loading: true });
    } else {
      set({ loading: true, error: null });
    }

    const result = await clientService.getClientById(id, companyId);
    if (myToken !== singleLoadToken) return;

    if (result.error) {
      set({ client: null, error: result.error, loading: false });
    } else {
      set({ client: result.data, error: null, loading: false });
    }
  },

  setClient: (client: Client) => set({ client }),
}));
