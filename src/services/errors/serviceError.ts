import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Categorías de error que la UI necesita distinguir para dar el
 * mensaje correcto y decidir si ofrecer "reintentar". Deliberadamente
 * plano (no una jerarquía de excepciones): cada servicio migrado a
 * Supabase devuelve este tipo en vez de lanzar, así los componentes
 * manejan el caso de error con un simple `if (result.error)` en vez de
 * try/catch disperso -- mismo espíritu que el resto de la app (los
 * servicios de Fase 1/2 devuelven `T | undefined`, nunca lanzan).
 */
export type ServiceErrorKind = 'network' | 'auth' | 'forbidden' | 'not_found' | 'unknown';

export interface ServiceError {
  kind: ServiceErrorKind;
  /** Mensaje ya listo para mostrar al usuario, en español, sin detalles técnicos. */
  message: string;
  /** Causa original para logging/depuración -- nunca se muestra directamente en UI. */
  cause?: unknown;
}

export type ServiceResult<T> = { data: T; error: null } | { data: null; error: ServiceError };

function isPostgrestError(err: unknown): err is PostgrestError {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}

/**
 * Traduce un error de Supabase (Postgrest/red) a un ServiceError con
 * mensaje en español listo para UI. Único lugar donde se interpreta
 * `error.code` -- si algún día cambia el mapeo, se ajusta aquí y todos
 * los servicios migrados se benefician.
 */
export function mapSupabaseError(err: unknown): ServiceError {
  // Fallo de red / fetch (sin conexión, DNS, CORS, timeout) -- no trae
  // `code` de Postgrest, es un TypeError nativo del navegador o similar.
  if (err instanceof TypeError || (err instanceof Error && err.message.toLowerCase().includes('fetch'))) {
    return {
      kind: 'network',
      message: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
      cause: err,
    };
  }

  if (isPostgrestError(err)) {
    // PGRST301 = JWT expired/inválido.
    if (err.code === 'PGRST301') {
      return {
        kind: 'auth',
        message: 'Tu sesión expiró. Vuelve a iniciar sesión.',
        cause: err,
      };
    }
    // 42501 = insufficient_privilege (Postgres) -- RLS bloqueó la operación.
    if (err.code === '42501') {
      return {
        kind: 'forbidden',
        message: 'No tienes permiso para realizar esta acción.',
        cause: err,
      };
    }
    // PGRST116 = "no rows returned" en una consulta que esperaba
    // exactamente una fila (.single()).
    if (err.code === 'PGRST116') {
      return {
        kind: 'not_found',
        message: 'No encontramos el registro solicitado.',
        cause: err,
      };
    }
    return {
      kind: 'unknown',
      message: 'Ocurrió un error inesperado. Intenta de nuevo.',
      cause: err,
    };
  }

  return {
    kind: 'unknown',
    message: 'Ocurrió un error inesperado. Intenta de nuevo.',
    cause: err,
  };
}

export function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

export function fail(error: ServiceError): ServiceResult<never> {
  return { data: null, error };
}
