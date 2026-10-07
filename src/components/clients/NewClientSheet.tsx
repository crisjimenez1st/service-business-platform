import { useState } from 'react';
import { Sheet, Button } from '../ui';
import FollowupWhenPicker from './FollowupWhenPicker';
import type { ClientDomainInput } from '../../services/mappers/clientMapper';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { useTerms } from '../../hooks/useTerms';
import { getTodayKeyInTimezone } from '../../utils/timezone';
import { resolveFollowupDate, type FollowupChoice } from '../../utils/followupDates';
import { t } from '../../i18n/es';

interface NewClientSheetProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: ClientDomainInput, followup: { dueDate: string; reason?: string } | null) => Promise<boolean>;
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
  const [consent, setConsent] = useState(true);
  const [choice, setChoice] = useState<FollowupChoice>('none');
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { company } = useCurrentCompany();
  const terms = useTerms();
  const timezone = company?.timezone ?? 'America/Managua';

  function reset() {
    setConsent(true);
    setChoice('none');
    setCustomDate('');
    setReason('');
    setMoreOpen(false);
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

    const todayKey = getTodayKeyInTimezone(timezone);
    const dueDate = resolveFollowupDate(choice, customDate, todayKey);
    if (choice === 'custom' && !dueDate) {
      setError('Elige una fecha de hoy en adelante.');
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
      contactConsent: consent,
    }, dueDate ? { dueDate, reason: reason.trim() || undefined } : null);
    setSaving(false);

    if (ok) {
      reset();
      onClose();
    } else {
      setError('No pudimos guardar. Intenta de nuevo.');
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={terms.newClient}
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

        <label className="flex items-start gap-3 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <span className="text-sm text-slate-700">{terms.acceptsReminders}</span>
        </label>

        {consent && (
          <FollowupWhenPicker
            question={terms.whenReturn}
            choice={choice}
            onChoice={setChoice}
            customDate={customDate}
            onCustomDate={setCustomDate}
            reason={reason}
            onReason={setReason}
            minDate={getTodayKeyInTimezone(timezone)}
          />
        )}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 min-h-9"
        >
          {moreOpen ? 'Menos datos' : 'Más datos (correo, dirección, notas)'}
        </button>

        {moreOpen && (
          <div className="space-y-4">
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

          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </Sheet>
  );
}
