import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button, Card, Sheet } from '../ui';
import { logRecordAccess } from '../../services/accessLogService';
import { getClientPlans } from '../../services/planService';
import { downloadPatientPdf } from '../../utils/patientExportPdf';
import type { Client, Job, MedicalProfile, VisitRecord } from '../../types';

interface Props {
  companyId: string;
  companyName: string;
  timezone: string;
  client: Client;
  jobs: Job[];
  records: Record<string, VisitRecord>;
  medical: MedicalProfile | null;
  /** Elimina al paciente; devuelve true si se eliminó. */
  onDelete: () => Promise<boolean>;
}

/** Descargar el expediente o eliminar al paciente (solo dueño). */
export default function PatientDataCard({ companyId, companyName, timezone, client, jobs, records, medical, onDelete }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [typed, setTyped] = useState('');

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const plans = await getClientPlans(companyId, client.id);
      await logRecordAccess(companyId, client.id, 'export');
      await downloadPatientPdf({
        companyName,
        timezone,
        client,
        jobs,
        records,
        medical,
        plans: plans.error ? null : plans.data,
        includeClinical: true,
      });
    } catch {
      setError('No pudimos generar el PDF. Intenta de nuevo.');
    }
    setBusy(false);
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    await logRecordAccess(companyId, client.id, 'delete');
    const ok = await onDelete();
    setBusy(false);
    if (!ok) setError('No pudimos eliminar al paciente. Intenta de nuevo.');
  }

  const canConfirm = typed.trim().toLowerCase() === client.name.trim().toLowerCase();

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Datos del paciente</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          El paciente puede pedir una copia de su información o que la eliminemos. Solo el dueño puede hacerlo.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" icon={<Download size={16} />} disabled={busy} onClick={handleExport}>
          Descargar expediente (PDF)
        </Button>
        <Button variant="danger" icon={<Trash2 size={16} />} disabled={busy} onClick={() => setDelOpen(true)}>
          Eliminar paciente
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <Sheet
        open={delOpen}
        onClose={() => !busy && setDelOpen(false)}
        title="Eliminar paciente"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth disabled={busy} onClick={() => setDelOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" fullWidth disabled={busy || !canConfirm} onClick={handleDelete}>
              {busy ? 'Eliminando…' : 'Eliminar para siempre'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Se borrarán <strong>{client.name}</strong> y todo lo suyo: citas, historial médico, notas de atención, planes y
            pagos. Esto no se puede deshacer. Si lo necesitas, descarga antes su expediente.
          </p>
          <label className="block text-sm font-medium text-slate-700" htmlFor="del-confirm">
            Para confirmar, escribe el nombre del paciente
          </label>
          <input
            id="del-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={client.name}
            className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      </Sheet>
    </Card>
  );
}
