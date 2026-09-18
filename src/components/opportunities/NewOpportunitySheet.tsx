import { useState } from 'react';
import { ChevronRight, User } from 'lucide-react';
import { Sheet, Button } from '../ui';
import ClientPickerSheet from '../quotes/ClientPickerSheet';
import type { Client, OpportunityCategory } from '../../types';
import { OPPORTUNITY_CATEGORY_LABELS } from '../../types/opportunity';
import type { OpportunityDomainInput } from '../../services/mappers/opportunityMapper';
import { todayIso } from '../../utils/dates';
import { t } from '../../i18n/es';

interface NewOpportunitySheetProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  onCreate: (input: OpportunityDomainInput) => Promise<boolean>;
}

const CATEGORY_OPTIONS = Object.entries(OPPORTUNITY_CATEGORY_LABELS) as [OpportunityCategory, string][];

/**
 * Formulario de alta de oportunidad -- crea directamente contra
 * Supabase vía opportunityStore.create (opportunityService.createOpportunity,
 * ya migrado). Tercer gap encontrado durante la validación real de
 * Fase 2.6, mismo patrón que Nuevo/Editar Cliente: el CRUD ya existía
 * en el servicio pero no estaba conectado a ningún botón visible.
 *
 * Reutiliza ClientPickerSheet (ya construido para QuoteFormPage) para
 * seleccionar el cliente -- es genérico, no depende de nada específico
 * de cotizaciones.
 */
export default function NewOpportunitySheet({
  open,
  onClose,
  clients,
  onCreate,
}: NewOpportunitySheetProps) {
  const [selectedClient, setSelectedClient] = useState<Client | undefined>(undefined);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [category, setCategory] = useState<OpportunityCategory>('maintenance');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [dueDate, setDueDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSelectedClient(undefined);
    setCategory('maintenance');
    setTitle('');
    setReason('');
    setEstimatedValue('');
    setDueDate(todayIso());
    setError(null);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleSave() {
    if (!selectedClient) {
      setError(t.opportunities.clientRequired);
      return;
    }
    if (!title.trim()) {
      setError(t.opportunities.titleRequired);
      return;
    }

    setSaving(true);
    setError(null);
    const ok = await onCreate({
      clientId: selectedClient.id,
      category,
      title: title.trim(),
      reason: reason.trim() || undefined,
      estimatedValue: Number(estimatedValue) || 0,
      dueDate,
    });
    setSaving(false);

    if (ok) {
      reset();
      onClose();
    } else {
      setError('No pudimos crear la oportunidad. Intenta de nuevo.');
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={handleClose}
        title={t.opportunities.newOpportunity}
        footer={
          <Button fullWidth onClick={handleSave} disabled={saving}>
            {saving ? t.common.loading : t.clients.save}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t.opportunities.client} *
            </label>
            <button
              onClick={() => setClientPickerOpen(true)}
              className="w-full flex items-center gap-3 rounded-xl border border-slate-300 px-3 py-3 min-h-11 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <User size={14} className="text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                {selectedClient ? (
                  <p className="text-sm font-medium text-slate-900 truncate">{selectedClient.name}</p>
                ) : (
                  <p className="text-sm text-slate-500">{t.opportunities.client}</p>
                )}
              </div>
              <ChevronRight size={16} className="text-slate-500 shrink-0" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t.opportunities.category}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as OpportunityCategory)}
              className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 bg-white"
            >
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t.opportunities.titleField} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t.opportunities.estimatedValue}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t.opportunities.dueDate}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t.opportunities.reason}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      </Sheet>

      <ClientPickerSheet
        open={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        clients={clients}
        onSelect={setSelectedClient}
      />
    </>
  );
}
