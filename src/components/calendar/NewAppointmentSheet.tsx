import { useMemo, useState } from 'react';
import { Sheet, Button } from '../ui';
import { INPUT_CLASS } from '../payments/inputClasses';
import { localDateTimeToTimezoneIso } from '../../utils/timezone';
import type { Client, CurrencyCode } from '../../types';
import type { NewAppointmentInput } from '../../services/appointmentService';

interface NewAppointmentSheetProps {
  open: boolean;
  clients: Client[];
  clientLabel: string;
  /** Servicios de las reglas de regreso (se ofrecen como botones). */
  serviceOptions: string[];
  timezone: string;
  currency: CurrencyCode;
  onClose: () => void;
  /** Crea al paciente nuevo (nombre y teléfono) y devuelve su id, o null si falló. */
  onCreateClient: (input: { name: string; phone: string }) => Promise<string | null>;
  /** Devuelve un mensaje de error o null si se guardó. */
  onSave: (input: NewAppointmentInput) => Promise<string | null>;
  /** Para abrir la hoja ya con el paciente y/o el servicio elegidos (p. ej. desde una solicitud). */
  initialClientId?: string | null;
  initialService?: string;
}

/** Agendar una cita directa: paciente, servicio (obligatorio), fecha y hora, precio opcional. Se monta solo al abrir. */
export default function NewAppointmentSheet({
  open,
  clients,
  clientLabel,
  serviceOptions,
  timezone,
  currency,
  onClose,
  onCreateClient,
  onSave,
  initialClientId = null,
  initialService = '',
}: NewAppointmentSheetProps) {
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState<string | null>(initialClientId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [service, setService] = useState(initialService);
  const [startValue, setStartValue] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
      .slice(0, 6);
  }, [clients, query]);

  const selected = clients.find((c) => c.id === clientId);

  async function handleCreateClient() {
    if (!newName.trim() || !newPhone.trim()) {
      setError('Escribe el nombre y el teléfono.');
      return;
    }
    setSaving(true);
    setError(null);
    const id = await onCreateClient({ name: newName.trim(), phone: newPhone.trim() });
    setSaving(false);
    if (id) {
      setClientId(id);
      setCreating(false);
      setNewName('');
      setNewPhone('');
    } else {
      setError('No se pudo crear. Revisa los datos e intenta de nuevo.');
    }
  }

  async function handleSave() {
    if (!clientId) {
      setError(`Elige a la persona (${clientLabel.toLowerCase()}).`);
      return;
    }
    if (!service.trim()) {
      setError('Elige el servicio de la cita.');
      return;
    }
    if (!startValue) {
      setError('Elige la fecha y la hora.');
      return;
    }
    let total: number | null = null;
    if (price.trim()) {
      total = Number(price.replace(',', '.'));
      if (!Number.isFinite(total) || total <= 0) {
        setError('El precio debe ser un número mayor a cero, o déjalo vacío.');
        return;
      }
    }
    setSaving(true);
    setError(null);
    const err = await onSave({
      clientId,
      service: service.trim(),
      startAtIso: localDateTimeToTimezoneIso(startValue, timezone),
      total,
    });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={() => !saving && onClose()}
      title="Nueva cita"
      footer={
        <Button fullWidth onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Agendar cita'}
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
        ) : creating ? (
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-700">Nuevo {clientLabel.toLowerCase()}</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre completo"
              className={INPUT_CLASS}
              autoFocus
            />
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Teléfono"
              className={INPUT_CLASS}
            />
            <div className="flex gap-2">
              <Button onClick={handleCreateClient} disabled={saving}>
                Crear y elegir
              </Button>
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="appt-search" className="block text-sm font-medium text-slate-700 mb-1.5">
              {clientLabel}
            </label>
            <input
              id="appt-search"
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
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setNewName(query.trim());
              }}
              className="mt-2 text-sm font-medium text-brand-700 min-h-9"
            >
              + Crear {clientLabel.toLowerCase()} nuevo
            </button>
          </div>
        )}

        <div>
          <label htmlFor="appt-service" className="block text-sm font-medium text-slate-700 mb-1.5">
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
            id="appt-service"
            type="text"
            value={service}
            onChange={(e) => setService(e.target.value)}
            maxLength={120}
            placeholder={serviceOptions.length > 0 ? 'O escribe otro servicio' : 'Ej. Limpieza dental'}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="appt-start" className="block text-sm font-medium text-slate-700 mb-1.5">
            Fecha y hora
          </label>
          <input
            id="appt-start"
            type="datetime-local"
            value={startValue}
            onChange={(e) => setStartValue(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="appt-price" className="block text-sm font-medium text-slate-700 mb-1.5">
            Precio ({currency === 'USD' ? 'US$' : 'C$'}, opcional)
          </label>
          <input
            id="appt-price"
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Puedes dejarlo vacío"
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
