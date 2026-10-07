import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck, Phone } from 'lucide-react';
import { Button, EmptyState, ErrorState } from '../components/ui';
import { getPublicAppointment, respondPublicAppointment } from '../services/appointmentService';
import type { ServiceError } from '../services/errors/serviceError';
import { formatLongDateInTimezone, formatTimeInTimezone } from '../utils/timezone';
import type { AppointmentResponseValue, PublicAppointment } from '../types';

/**
 * Página pública (sin sesión) para confirmar o avisar que no se podrá
 * asistir a una cita. Es opcional para el paciente: es un recordatorio.
 * Solo expone nombre del negocio, nombre de pila, fecha y hora.
 */
export default function AppointmentConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<PublicAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const result = await getPublicAppointment(token);
    if (result.error) {
      setView(null);
      setError(result.error);
    } else {
      setError(null);
      setView(result.data);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const result = await getPublicAppointment(token);
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setView(result.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function respond(value: AppointmentResponseValue) {
    if (!token) return;
    setPending(true);
    setNotice(null);
    const result = await respondPublicAppointment(token, value);
    if (!result.error && result.data === 'not_available') {
      setNotice('Esta cita ya no admite cambios desde este enlace.');
    }
    await load();
    setPending(false);
  }

  const shell = 'min-h-screen bg-slate-50 flex items-center justify-center px-4';

  if (loading) {
    return <div className={shell}><p className="text-sm text-slate-500">Cargando…</p></div>;
  }
  if (error) {
    return <div className={shell}><ErrorState message={error.message} onRetry={load} /></div>;
  }
  if (!view || !token) {
    return <div className={shell}><EmptyState title="Enlace no válido" /></div>;
  }

  const date = formatLongDateInTimezone(view.scheduledStartAt, view.timezone);
  const time = formatTimeInTimezone(view.scheduledStartAt, view.timezone);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:py-10">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-brand-600 text-white px-6 py-6 flex items-center gap-3">
          {view.companyLogoUrl ? (
            <img src={view.companyLogoUrl} alt={view.companyName} className="w-10 h-10 rounded-lg object-cover bg-white" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
              <CalendarCheck size={20} />
            </div>
          )}
          <span className="font-semibold text-lg">{view.companyName}</span>
        </div>

        <div className="px-6 py-6 space-y-5">
          <div>
            <p className="text-lg font-semibold text-slate-900">Hola {view.clientFirstName}</p>
            <p className="text-sm text-slate-600 mt-1">Tu cita está programada para:</p>
            <p className="text-base font-medium text-slate-900 mt-2 capitalize">{date}</p>
            <p className="text-2xl font-semibold text-brand-700">{time}</p>
          </div>

          {view.response === 'confirmed' && (
            <p className="text-sm bg-emerald-50 text-emerald-800 rounded-lg px-3 py-2">¡Gracias! Tu cita quedó confirmada.</p>
          )}
          {view.response === 'declined' && (
            <p className="text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
              Le avisamos a la clínica que no podrás asistir.
            </p>
          )}
          {notice && <p className="text-sm text-slate-600">{notice}</p>}

          {view.canRespond ? (
            <div className="space-y-2">
              {view.response !== 'confirmed' && (
                <Button fullWidth disabled={pending} onClick={() => respond('confirmed')}>
                  Confirmo mi cita
                </Button>
              )}
              {view.response !== 'declined' && (
                <Button fullWidth variant="secondary" disabled={pending} onClick={() => respond('declined')}>
                  No podré asistir
                </Button>
              )}
              <p className="text-xs text-slate-500 text-center">Responder es opcional. Puedes cambiar tu respuesta cuando quieras.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Esta cita ya no admite cambios desde este enlace.</p>
          )}

          {view.companyPhone && (
            <a href={`tel:${view.companyPhone}`} className="flex items-center justify-center gap-2 text-sm text-brand-700 font-medium">
              <Phone size={16} /> Llamar a la clínica
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
