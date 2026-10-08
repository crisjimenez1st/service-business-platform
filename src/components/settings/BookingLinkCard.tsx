import { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { Button, Card } from '../ui';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { buildBookingLink, setBookingEnabled } from '../../services/bookingService';

/** Enlace público para que los pacientes pidan cita. Lo pueden copiar o mandar por WhatsApp. */
export default function BookingLinkCard() {
  const { company, refresh } = useCurrentCompany();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!company) return null;
  const link = buildBookingLink(company.bookingToken);
  const isOwner = company.role === 'owner';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar. Selecciona el enlace y cópialo a mano.');
    }
  }

  async function toggle() {
    if (!company) return;
    setBusy(true);
    setError(null);
    const result = await setBookingEnabled(company.id, !company.bookingEnabled);
    if (result.error) setError(result.error.message);
    else await refresh();
    setBusy(false);
  }

  const message = `Hola 👋 Puedes pedir tu cita en ${company.name} aquí:\n${link}`;

  return (
    <Card>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Pon este enlace en tu WhatsApp, Instagram o Facebook. Tus pacientes dejan sus datos y las solicitudes te llegan a{' '}
          <span className="font-medium">Solicitudes de cita</span>.
        </p>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Enlace para pedir cita"
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 min-h-11 text-sm text-slate-700"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={copy} disabled={!company.bookingEnabled}>
            <Copy size={16} className="mr-1.5" />
            {copied ? '¡Copiado!' : 'Copiar enlace'}
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <MessageCircle size={16} className="mr-1.5" /> Compartir por WhatsApp
          </a>
        </div>
        {isOwner && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-600">
              {company.bookingEnabled ? 'El enlace está activo.' : 'El enlace está apagado: nadie puede pedir cita.'}
            </p>
            <Button variant="secondary" onClick={toggle} disabled={busy}>
              {company.bookingEnabled ? 'Apagar' : 'Activar'}
            </Button>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Card>
  );
}
