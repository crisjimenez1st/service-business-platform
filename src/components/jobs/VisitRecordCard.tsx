import { useEffect, useState } from 'react';
import { ClipboardPlus, Lock } from 'lucide-react';
import { Button, Card } from '../ui';
import { getVisitRecord, saveVisitRecord } from '../../services/visitRecordService';
import { formatLongDateInTimezone } from '../../utils/timezone';
import type { VisitRecord, VisitRecordInput } from '../../types';

const FIELDS: { key: keyof VisitRecordInput; label: string; placeholder: string }[] = [
  { key: 'reason', label: 'Motivo de la consulta', placeholder: 'Ej. Dolor en una muela, control, limpieza...' },
  { key: 'diagnosis', label: 'Diagnóstico', placeholder: 'Lo que encontraste' },
  { key: 'treatment', label: 'Tratamiento realizado', placeholder: 'Lo que hiciste en esta visita' },
  { key: 'prescription', label: 'Receta e indicaciones', placeholder: 'Medicamentos e instrucciones para el paciente' },
  { key: 'nextSteps', label: 'Próximos pasos', placeholder: 'Ej. Control en 1 mes, continuar tratamiento...' },
];

interface VisitRecordCardProps {
  jobId: string;
  cancelled: boolean;
  timezone: string;
}

/**
 * Registro clínico de la atención. Lo ven y escriben solo el dueño y los
 * doctores; la recepción no tiene acceso (lo garantiza la base de datos).
 */
export default function VisitRecordCard({ jobId, cancelled, timezone }: VisitRecordCardProps) {
  const [record, setRecord] = useState<VisitRecord | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VisitRecordInput>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelledLoad = false;
    (async () => {
      const result = await getVisitRecord(jobId);
      if (cancelledLoad) return;
      if (result.error) {
        setLoadError(result.error.message);
        setRecord(null);
        return;
      }
      setRecord(result.data);
    })();
    return () => {
      cancelledLoad = true;
    };
  }, [jobId]);

  function startEdit() {
    setDraft({
      reason: record?.reason,
      diagnosis: record?.diagnosis,
      treatment: record?.treatment,
      prescription: record?.prescription,
      nextSteps: record?.nextSteps,
    });
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveVisitRecord(jobId, draft);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRecord(result.data);
    setEditing(false);
  }

  if (record === undefined) return <p className="text-center text-sm text-slate-500 py-8">Cargando…</p>;

  if (editing) {
    return (
      <Card className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`vr-${f.key}`} className="block text-sm font-medium text-slate-700 mb-1">
              {f.label}
            </label>
            <textarea
              id={`vr-${f.key}`}
              rows={f.key === 'reason' || f.key === 'nextSteps' ? 2 : 3}
              maxLength={4000}
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </div>
        ))}
        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar registro'}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </Card>
    );
  }

  const filled = record ? FIELDS.filter((f) => record[f.key]) : [];

  return (
    <div className="space-y-3">
      {loadError && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {loadError}
        </p>
      )}
      {filled.length === 0 ? (
        <Card>
          <div className="text-center py-4">
            <ClipboardPlus size={32} className="mx-auto text-brand-600" />
            <p className="text-sm font-medium text-slate-900 mt-2">Todavía no hay registro de esta atención</p>
            <p className="text-sm text-slate-500 mt-1">Anota el diagnóstico, el tratamiento y los próximos pasos para el historial del paciente.</p>
            {!cancelled && (
              <Button className="mt-3" onClick={startEdit}>
                Registrar atención
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {filled.map((f) => (
            <Card key={f.key}>
              <p className="text-xs text-slate-500 mb-1">{f.label}</p>
              <p className="text-sm text-slate-900 whitespace-pre-line">{record?.[f.key]}</p>
            </Card>
          ))}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Actualizado el {record ? formatLongDateInTimezone(record.updatedAt, timezone) : ''}
            </p>
            {!cancelled && (
              <Button variant="secondary" size="sm" onClick={startEdit}>
                Editar registro
              </Button>
            )}
          </div>
        </>
      )}
      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <Lock size={12} /> Solo el dueño y los médicos ven este registro. La recepción no.
      </p>
    </div>
  );
}
