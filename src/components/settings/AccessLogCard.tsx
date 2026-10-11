import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Card } from '../ui';
import { getAccessLog, type AccessKind, type AccessLogEntry } from '../../services/accessLogService';
import { formatLongDateInTimezone, formatTimeInTimezone } from '../../utils/timezone';

const KIND_LABEL: Record<AccessKind, string> = {
  view_clinical: 'Abrió el historial clínico de',
  export: 'Descargó el expediente de',
  delete: 'Eliminó a',
};
const ROLE_LABEL: Record<string, string> = { owner: 'Dueño', technician: 'Doctor', office: 'Recepción' };

/** Quién abrió, descargó o eliminó datos de pacientes (solo dueño). */
export default function AccessLogCard({ companyId, timezone }: { companyId: string; timezone: string }) {
  const [entries, setEntries] = useState<AccessLogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getAccessLog(companyId);
      if (cancelled) return;
      if (r.error) setFailed(true);
      else setEntries(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-flow-lilac text-brand-700">
          <History size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Registro de accesos</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Quién abrió historiales clínicos, descargó expedientes o eliminó pacientes. Los últimos movimientos.
          </p>
        </div>
      </div>
      {failed ? (
        <p className="text-sm text-slate-500">No pudimos cargar el registro.</p>
      ) : entries === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay movimientos.</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {entries.map((e, i) => (
            <li key={`${e.at}-${i}`} className="py-2 text-sm">
              <p className="text-slate-800">
                <span className="font-medium">{e.userEmail}</span>
                {e.userRole && <span className="text-slate-500"> ({ROLE_LABEL[e.userRole] ?? e.userRole})</span>}{' '}
                {KIND_LABEL[e.kind]} <span className="font-medium">{e.clientName}</span>
              </p>
              <p className="text-xs text-slate-500">
                {formatLongDateInTimezone(e.at, timezone)} · {formatTimeInTimezone(e.at, timezone)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
