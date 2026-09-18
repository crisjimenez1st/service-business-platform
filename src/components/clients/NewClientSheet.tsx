import { useState } from 'react';
import { Sheet, Button } from '../ui';
import type { ClientDomainInput } from '../../services/mappers/clientMapper';
import { t } from '../../i18n/es';

interface NewClientSheetProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: ClientDomainInput) => Promise<boolean>;
}

/**
 * Formulario de alta de cliente -- crea directamente contra Supabase
 * vía clientStore.createClient (que ya llama a clientService.createClient,
 * migrado desde el bloque de Clients). Gap encontrado durante la
 * validación real de Fase 2.6: el CRUD de clientes se migró
 * completo, pero el botón/formulario de "nuevo cliente" nunca se
 * conectó en la UI -- este componente lo cierra.
 *
 * Solo name/phone son obligatorios (coincide con las columnas NOT
 * NULL de la tabla clients en Supabase); el resto son opcionales.
 */
export default function NewClientSheet({ open, onClose, onCreate }: NewClientSheetProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setPhone('');
    setWhatsapp('');
    setEmail('');
    setAddress('');
    setNotes('');
    setError(null);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t.clients.nameRequired);
      return;
    }
    if (!phone.trim()) {
      setError(t.clients.phoneRequired);
      return;
    }

    setSaving(true);
    setError(null);
    const ok = await onCreate({
      name: name.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSaving(false);

    if (ok) {
      reset();
      onClose();
    } else {
      setError('No pudimos guardar el cliente. Intenta de nuevo.');
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={t.clients.newClient}
      footer={
        <Button fullWidth onClick={handleSave} disabled={saving}>
          {saving ? t.common.loading : t.clients.save}
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.clients.name} *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.clients.phone} *
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.clients.whatsapp}
          </label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.clients.email}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.clients.address}
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t.clients.notes}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </Sheet>
  );
}
