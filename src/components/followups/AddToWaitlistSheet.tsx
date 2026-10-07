import { useMemo, useState } from 'react';
import { Sheet, Button } from '../ui';
import { INPUT_CLASS } from '../payments/inputClasses';
import type { Client } from '../../types';

interface AddToWaitlistSheetProps {
  open: boolean;
  clients: Client[];
  /** Ids ya en la lista (no se ofrecen de nuevo). */
  excludeClientIds: string[];
  clientLabel: string;
  /** Servicios ya definidos en las reglas de regreso (se ofrecen como opciones). */
  serviceOptions: string[];
  onClose: () => void;
  /** Devuelve un mensaje de error o null si se guardó. */
  onSave: (input: { clientId: string; note?: string; service?: string }) => Promise<string | null>;
}

/** Agregar a alguien a la lista de espera: buscar, nota ("prefiere mañanas") y servicio opcional. Se monta solo al abrir. */
export default function AddToWaitlistSheet({ open, clients, excludeClientIds, clientLabel, serviceOptions, onClose, onSave }: AddToWaitlistSheetProps) {
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [service, setService] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => !excludeClientIds.includes(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
      .slice(0, 6);
  }, [clients, excludeClientIds, query]);

  const selected = clients.find((c) => c.id === clientId);

  async function handleSave() {
    if (!clientId) {
      setError(`Elige a la persona (${clientLabel.toLowerCase()}).`);
      return;
    }
    if (!service.trim()) {
      setError('Elige el servicio que necesita, para saber qué aviso enviarle.');
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onSave({ clientId, note: note.trim() || undefined, service: service.trim() || undefined });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={() => !saving && onClose()}
      title="Agregar a la lista de espera"
      footer={
        <Button fullWidth onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Agregar'}
        </Button>
      }
    >
      <div className="space-y-4">
        {selected ? (
          <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2">
            <p className="text-sm font-medium text-slate-900">{selected.name}</p>
            <button type="button" onClick={() => setClientId(null)} className="text-sm text-brand-700 min-h-9">
              Cambiar
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="wl-search" className="block text-sm font-medium text-slate-700 mb-1.5">
              {clientLabel}
            </label>
            <input
              id="wl-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o teléfono"
              className={INPUT_CLASS}
              autoFocus
            />
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {matches.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-slate-500">Sin resultados.</li>
              ) : (
                matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setClientId(c.id)}
                      className="w-full text-left px-3 py-2.5 min-h-11 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">{c.name}</span>
                      <span className="ml-2 text-slate-500">{c.phone}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        <div>
          <label htmlFor="wl-note" className="block text-sm font-medium text-slate-700 mb-1.5">
            Nota (opcional)
          </label>
          <input
            id="wl-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Ej. prefiere mañanas, solo sábados"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="wl-service" className="block text-sm font-medium text-slate-700 mb-1.5">
            Servicio
          </label>
          {serviceOptions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {serviceOptions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setService(name)}
                  className={[
                    'px-3 min-h-9 rounded-full border text-sm',
                    service === name
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <input
            id="wl-service"
            type="text"
            value={service}
            onChange={(e) => setService(e.target.value)}
            maxLength={120}
            placeholder={serviceOptions.length > 0 ? 'O escribe otro servicio' : 'Ej. Limpieza dental'}
            className={INPUT_CLASS}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
