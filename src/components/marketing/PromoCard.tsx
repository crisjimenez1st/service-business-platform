import { useState } from 'react';
import { Gift } from 'lucide-react';
import { Button, Card } from '../ui';
import { INPUT_CLASS } from '../payments/inputClasses';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { setBirthdayPromo } from '../../services/companySetupService';

/** La promoción que se manda junto a la felicitación de cumpleaños. La edita el dueño. */
export default function PromoCard() {
  const { company, refresh } = useCurrentCompany();
  const [value, setValue] = useState(company?.birthdayPromo ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!company) return null;
  const isOwner = company.role === 'owner';

  async function save() {
    if (!company) return;
    setBusy(true);
    setMessage(null);
    const r = await setBirthdayPromo(company.id, value);
    if (r.error) setMessage({ ok: false, text: r.error.message });
    else {
      await refresh();
      setMessage({ ok: true, text: 'Promoción guardada.' });
    }
    setBusy(false);
  }

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-brand-700">
          <Gift size={20} />
          <h2 className="text-base font-semibold text-slate-900">Tu promoción de cumpleaños</h2>
        </div>
        <p className="text-sm text-slate-600">
          Se envía junto a la felicitación. Ejemplo: “10% de descuento en tu próxima limpieza este mes”.
        </p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!isOwner}
          maxLength={300}
          rows={2}
          placeholder="Escribe el regalo o descuento que ofreces"
          aria-label="Promoción de cumpleaños"
          className={INPUT_CLASS}
        />
        {isOwner ? (
          <Button onClick={save} disabled={busy || value.trim() === (company.birthdayPromo ?? '')}>
            {busy ? 'Guardando…' : 'Guardar promoción'}
          </Button>
        ) : (
          <p className="text-xs text-slate-500">Solo el dueño puede cambiarla.</p>
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
