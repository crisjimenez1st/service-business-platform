import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, Phone } from 'lucide-react';
import { Button, EmptyState, ErrorState } from '../components/ui';
import { INPUT_CLASS } from '../components/payments/inputClasses';
import { getPublicBooking, submitAppointmentRequest } from '../services/bookingService';
import type { ServiceError } from '../services/errors/serviceError';
import type { PublicBooking } from '../types';

/**
 * Página pública (sin sesión): el paciente pide una cita desde el enlace del
 * consultorio. No agenda nada: deja una solicitud y la recepción le responde.
 */
export default function BookingPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<PublicBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);
  const [reload, setReload] = useState(0);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('');
  const [preferred, setPreferred] = useState('');
  const [note, setNote] = useState('');
  const [trap, setTrap] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const result = await getPublicBooking(token);
      if (cancelled) return;
      if (result.error) setError(result.error);
      else {
        setError(null);
        setView(result.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, reload]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || sending) return;
    setFormError(null);
    if (name.trim().length < 2) return setFormError('Escribe tu nombre.');
    if (phone.replace(/\D/g, '').length < 7) return setFormError('Escribe un número de teléfono o WhatsApp válido.');
    if (!service.trim()) return setFormError('Cuéntanos qué necesitas (servicio o motivo).');
    // Campo trampa para bots: una persona nunca lo ve ni lo llena.
    if (trap) {
      setDone(true);
      return;
    }
    setSending(true);
    const result = await submitAppointmentRequest({
      token,
      name: name.trim(),
      phone: phone.trim(),
      service: service.trim(),
      preferred: preferred.trim(),
      note: note.trim(),
    });
    setSending(false);
    if (result.error) return setFormError(result.error.message);
    switch (result.data) {
      case 'ok':
        setDone(true);
        break;
      case 'too_many':
        setFormError('Ya enviaste varias solicitudes. Espera un rato o llama al consultorio.');
        break;
      case 'not_found':
        setFormError('Este enlace ya no está disponible. Llama al consultorio.');
        break;
      default:
        setFormError('Revisa tus datos e intenta de nuevo.');
    }
  }

  const shell = 'min-h-screen bg-slate-50 flex items-center justify-center px-4';
  if (loading) return <div className={shell}><p className="text-sm text-slate-500">Cargando…</p></div>;
  if (error) return <div className={shell}><ErrorState message={error.message} onRetry={() => setReload((n) => n + 1)} /></div>;
  if (!view || !token) {
    return (
      <div className={shell}>
        <EmptyState title="Enlace no disponible" description="Este enlace no existe o el consultorio lo desactivó." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:py-10">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 text-white px-6 py-6 flex items-center gap-3">
          {view.companyLogoUrl ? (
            <img src={view.companyLogoUrl} alt={view.companyName} className="w-11 h-11 rounded-xl object-cover bg-white" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
              <CalendarPlus size={22} />
            </div>
          )}
          <div>
            <p className="font-brand font-semibold text-lg leading-tight">{view.companyName}</p>
            <p className="text-sm text-white/80">Pide tu cita</p>
          </div>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center space-y-3">
            <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
            <p className="text-lg font-semibold text-slate-900">¡Solicitud enviada!</p>
            <p className="text-sm text-slate-600">
              El consultorio te escribirá o llamará pronto para confirmar el día y la hora de tu cita.
            </p>
            {view.companyPhone && (
              <a href={`tel:${view.companyPhone}`} className="inline-flex items-center gap-2 text-sm text-brand-700 font-medium">
                <Phone size={16} /> Llamar al consultorio
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            <p className="text-sm text-slate-600">
              Déjanos tus datos y el consultorio te confirmará tu cita. Tarda menos de un minuto.
            </p>

            <div>
              <label htmlFor="bk-name" className="block text-sm font-medium text-slate-700 mb-1.5">Tu nombre</label>
              <input id="bk-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" className={INPUT_CLASS} />
            </div>

            <div>
              <label htmlFor="bk-phone" className="block text-sm font-medium text-slate-700 mb-1.5">Teléfono o WhatsApp</label>
              <input id="bk-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} autoComplete="tel" className={INPUT_CLASS} />
            </div>

            <div>
              <label htmlFor="bk-service" className="block text-sm font-medium text-slate-700 mb-1.5">¿Qué necesitas?</label>
              {view.services.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {view.services.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setService(s)}
                      className={[
                        'px-3 min-h-9 rounded-full border text-sm',
                        service === s ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <input
                id="bk-service"
                type="text"
                value={service}
                onChange={(e) => setService(e.target.value)}
                maxLength={120}
                placeholder={view.services.length > 0 ? 'O escribe otro motivo' : 'Ej. Limpieza, consulta, dolor de muela'}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="bk-pref" className="block text-sm font-medium text-slate-700 mb-1.5">¿Qué día y hora te quedan bien? (opcional)</label>
              <input id="bk-pref" type="text" value={preferred} onChange={(e) => setPreferred(e.target.value)} maxLength={200} placeholder="Ej. Martes o jueves por la tarde" className={INPUT_CLASS} />
            </div>

            <div>
              <label htmlFor="bk-note" className="block text-sm font-medium text-slate-700 mb-1.5">Algo más que debamos saber (opcional)</label>
              <textarea id="bk-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={INPUT_CLASS} />
            </div>

            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                No llenar
                <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
              </label>
            </div>

            {formError && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
            )}

            <Button type="submit" fullWidth disabled={sending}>
              {sending ? 'Enviando…' : 'Pedir mi cita'}
            </Button>
            <p className="text-xs text-slate-500 text-center">Esto es una solicitud: tu cita queda confirmada cuando el consultorio te responda.</p>
          </form>
        )}
      </div>
    </div>
  );
}
