import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button, Card } from '../ui';
import { INPUT_CLASS } from '../payments/inputClasses';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { useServiceRulesStore } from '../../store/serviceRulesStore';
import { useTerms } from '../../hooks/useTerms';
import type { ServiceRule } from '../../types';

const MONTH_OPTIONS = [1, 2, 3, 4, 6, 9, 12, 18, 24];

function monthsLabel(m: number): string {
  return m === 1 ? '1 mes' : m === 12 ? '1 año' : m === 24 ? '2 años' : `${m} meses`;
}

/** Reglas de regreso: "este servicio vuelve en N meses". Al terminar una cita, la fecha se sugiere sola. */
export default function ServiceRulesCard() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const terms = useTerms();
  const rules = useServiceRulesStore((s) => s.rules);
  const loading = useServiceRulesStore((s) => s.loading);
  const loadError = useServiceRulesStore((s) => s.error);
  const load = useServiceRulesStore((s) => s.load);
  const create = useServiceRulesStore((s) => s.create);
  const update = useServiceRulesStore((s) => s.update);
  const remove = useServiceRulesStore((s) => s.remove);

  const [editing, setEditing] = useState<ServiceRule | 'new' | null>(null);
  const [name, setName] = useState('');
  const [months, setMonths] = useState(6);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) load(companyId);
  }, [companyId, load]);

  function openNew() {
    setEditing('new');
    setName('');
    setMonths(6);
    setReason('');
    setError(null);
  }

  function openEdit(rule: ServiceRule) {
    setEditing(rule);
    setName(rule.serviceName);
    setMonths(rule.months);
    setReason(rule.reason);
    setError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Escribe el nombre del servicio.');
      return;
    }
    setSaving(true);
    setError(null);
    const input = { serviceName: name, months, reason };
    const err = editing === 'new' ? await create(input) : editing ? await update(editing.id, input) : null;
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditing(null);
  }

  async function handleDelete(rule: ServiceRule) {
    const err = await remove(rule.id);
    if (err) setError(err.message);
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700">Cuándo debe volver, según el servicio</p>
        <p className="text-sm text-slate-500 mt-1">
          Ejemplo: Limpieza → 6 meses. Al terminar una {terms.job.toLowerCase()} de ese servicio, la fecha de regreso ya
          viene elegida y solo la confirmas. El nombre debe ser igual al del servicio de la {terms.job.toLowerCase()}.
        </p>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {loadError.message}
        </p>
      ) : loading && rules.length === 0 ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : rules.length === 0 && !editing ? (
        <p className="text-sm text-slate-500">Todavía no hay reglas.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{r.serviceName}</p>
                <p className="text-xs text-slate-500">
                  Vuelve en {monthsLabel(r.months)}
                  {r.reason ? ` · ${r.reason}` : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={`Editar ${r.serviceName}`}
                  onClick={() => openEdit(r)}
                  className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar ${r.serviceName}`}
                  onClick={() => handleDelete(r)}
                  className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          <div>
            <label htmlFor="rule-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              Servicio
            </label>
            <input
              id="rule-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Ej. Limpieza"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="rule-months" className="block text-sm font-medium text-slate-700 mb-1.5">
              Vuelve en
            </label>
            <select
              id="rule-months"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className={INPUT_CLASS}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {monthsLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-reason" className="block text-sm font-medium text-slate-700 mb-1.5">
              Motivo del aviso (opcional)
            </label>
            <input
              id="rule-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
              placeholder="Ej. control"
              className={INPUT_CLASS}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button fullWidth onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar regla'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button variant="secondary" icon={<Plus size={16} />} onClick={openNew}>
            Agregar regla
          </Button>
        </>
      )}
    </Card>
  );
}
