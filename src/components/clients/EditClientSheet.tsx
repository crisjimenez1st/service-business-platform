import { useState } from 'react';
import { Sheet, Button } from '../ui';
import type { Client } from '../../types';
import type { ClientDomainInput } from '../../services/mappers/clientMapper';
import { t } from '../../i18n/es';

interface EditClientSheetProps {
  open: boolean;
  client: Client;
  onClose: () => void;
  onSave: (patch: Partial<ClientDomainInput>) => Promise<boolean>;
}

/**
 * Formulario de edición de cliente -- guarda directamente contra
 * Supabase vía clientStore.updateClient (clientService.updateClient,
 * ya migrado). Segundo gap encontrado durante la validación real de
 * Fase 2.6: ClientProfilePage no tenía ningún camino hacia edición.
 *
 * Se re-monta con `key={client.id}` desde el caller cada vez que se
 * abre para un cliente distinto, así que los useState locales siempre
 * arrancan con los valores correctos del cliente actual -- mismo
 * patrón que QuoteFormPage usa para su modo edición.
 */
export default function EditClientSheet({ open, client, onClose, onSave }: EditClientSheetProps) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [whatsapp, setWhatsapp] = useState(client.whatsapp ?? '');
  const [email, setEmail] = useState(client.email ?? '');
  const [address, setAddress] = useState(client.address ?? '');
  const [notes, setNotes] = useState(client.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (saving) return;
    setError(null);
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
    const ok = await onSave({
      name: name.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSaving(false);

    if (ok) {
      onClose();
    } else {
      setError('No pudimos guardar los cambios. Intenta de nuevo.');
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={t.clientProfile.editClient}
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
