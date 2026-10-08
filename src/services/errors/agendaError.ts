import { mapSupabaseError, type ServiceError } from './serviceError';

/**
 * Los RPCs del Bloque 8 lanzan `raise exception` con mensajes pensados
 * para personas (P0001). Se traducen a mensajes fijos, nunca se muestra
 * el texto crudo del servidor.
 */
const BUSINESS_ERRORS: { match: string; message: string }[] = [
  { match: 'ya está en la lista de espera', message: 'Esa persona ya está en la lista de espera.' },
  { match: 'Cliente no encontrado', message: 'No encontramos a esa persona.' },
  { match: 'Entrada no encontrada', message: 'Esa entrada ya no está en la lista.' },
  { match: 'no admite recordatorio', message: 'Esta cita ya no admite recordatorio.' },
  { match: 'Cita no encontrada', message: 'No encontramos esa cita.' },
  { match: 'Elige el servicio', message: 'Elige el servicio de la cita.' },
  { match: 'Indica la fecha', message: 'Indica la fecha y hora de la cita.' },
  { match: 'hora de fin', message: 'La hora de fin no puede ser anterior a la de inicio.' },
  { match: 'precio debe ser', message: 'El precio debe ser mayor a cero (o déjalo vacío).' },
  { match: 'no pertenece a esta empresa', message: 'Esa persona no pertenece a este negocio.' },
  { match: 'demasiado largo', message: 'El nombre del servicio es demasiado largo.' },
  { match: 'No autorizado', message: 'No tienes permiso para realizar esta acción.' },
  { match: 'No autenticado', message: 'Tu sesión expiró. Vuelve a iniciar sesión.' },
];

export function mapAgendaError(err: unknown): ServiceError {
  if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
    const { code, message } = err as { code: string; message: string };
    if (code === 'P0001') {
      const known = BUSINESS_ERRORS.find((e) => message.includes(e.match));
      if (known) return { kind: 'unknown', message: known.message, cause: err };
    }
    if (code === '23505') {
      return { kind: 'unknown', message: 'Ya existe una regla para ese servicio.', cause: err };
    }
    if (code === '23514') {
      return { kind: 'unknown', message: 'Revisa los datos: algún valor no es válido.', cause: err };
    }
  }
  return mapSupabaseError(err);
}
