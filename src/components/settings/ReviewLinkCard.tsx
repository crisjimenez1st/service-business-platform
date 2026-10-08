import { useState } from 'react';
import { Button, Card } from '../ui';
import { INPUT_CLASS } from '../payments/inputClasses';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { setReviewUrl } from '../../services/companySetupService';

/** Se pega una sola vez el enlace de reseñas (p. ej. el de Google); la página Reseñas lo usa para todos. */
export default function ReviewLinkCard() {
  const { company, refresh } = useCurrentCompany();
  const [value, setValue] = useState(company?.reviewUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!company) return null;
  const isOwner = company.role === 'owner';

  async function save() {
    if (!company) return;
    setBusy(true);
    setMessage(null);
    const r = await setReviewUrl(company.id, value);
    if (r.error) setMessage({ ok: false, text: r.error.message });
    else {
      await refresh();
      setMessage({ ok: true, text: 'Guardado.' });
    }
    setBusy(false);
  }

  return (
    <Card>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Pega aquí el enlace donde tus pacientes dejan su reseña (por ejemplo, el de Google). Solo se hace una vez; luego, en{' '}
          <span className="font-medium">Reseñas</span>, le ofreces dejarla a cada paciente atendido.
        </p>
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!isOwner}
          placeholder="https://g.page/r/..."
          aria-label="Enlace de reseñas"
          className={INPUT_CLASS}
        />
        {isOwner ? (
          <Button onClick={save} disabled={busy || value.trim() === (company.reviewUrl ?? '')}>
            {busy ? 'Guardando…' : 'Guardar enlace'}
          </Button>
        ) : (
          <p className="text-xs text-slate-500">Solo el dueño puede cambiarlo.</p>
        )}
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={['text-sm rounded-lg px-3 py-2', message.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'].join(' ')}>
            {message.text}
          </p>
        )}
      </div>
    </Card>
  );
}
