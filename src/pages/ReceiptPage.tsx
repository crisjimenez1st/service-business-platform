import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Phone, Receipt } from 'lucide-react';
import { Button, EmptyState, ErrorState } from '../components/ui';
import { getPublicReceipt } from '../services/receiptService';
import type { ServiceError } from '../services/errors/serviceError';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import { formatCurrency } from '../utils/currency';
import { formatLongDateInTimezone, formatTimeInTimezone } from '../utils/timezone';
import { PAYMENT_METHOD_LABELS } from '../utils/paymentStatus';
import type { PublicReceipt } from '../types';

/** Página pública (sin sesión) del recibo de un pago, con descarga en PDF. */
export default function ReceiptPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<PublicReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const result = await getPublicReceipt(token);
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setView(result.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const shell = 'min-h-screen bg-slate-50 flex items-center justify-center px-4';
  if (loading) return <div className={shell}><p className="text-sm text-slate-500">Cargando…</p></div>;
  if (error) return <div className={shell}><ErrorState message={error.message} onRetry={() => window.location.reload()} /></div>;
  if (!view) return <div className={shell}><EmptyState title="Enlace no válido" /></div>;

  const method = PAYMENT_METHOD_LABELS[view.method as keyof typeof PAYMENT_METHOD_LABELS] ?? view.method;
  const money = (n: number) => formatCurrency(n, view.currency);

  async function handleDownload() {
    if (!view) return;
    setPdfError(false);
    try {
      await downloadReceiptPdf(view);
    } catch {
      setPdfError(true);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:py-10">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-brand-600 text-white px-6 py-6 flex items-center gap-3">
          {view.companyLogoUrl ? (
            <img src={view.companyLogoUrl} alt={view.companyName} className="w-10 h-10 rounded-lg object-cover bg-white" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
              <Receipt size={20} />
            </div>
          )}
          <div>
            <p className="font-semibold text-lg leading-tight">{view.companyName}</p>
            <p className="text-brand-100 text-sm">Recibo N.º {view.receiptCode}</p>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          {view.voided ? (
            <p className="text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
              Este recibo fue anulado por la clínica. Si tienes dudas, comunícate con ella.
            </p>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm text-slate-500">Monto recibido</p>
                <p className="text-3xl font-semibold text-brand-700">{view.amount !== undefined ? money(view.amount) : '—'}</p>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Paciente" value={view.clientFirstName} />
                <Row label="Servicio" value={view.serviceName} />
                <Row
                  label="Fecha"
                  value={`${formatLongDateInTimezone(view.paidAt, view.timezone)}, ${formatTimeInTimezone(view.paidAt, view.timezone)}`}
                />
                <Row label="Forma de pago" value={method} />
                {view.balance !== undefined && <Row label="Saldo pendiente" value={money(view.balance)} />}
              </dl>
              <Button fullWidth icon={<Download size={18} />} onClick={handleDownload}>
                Descargar PDF
              </Button>
              {pdfError && <p className="text-sm text-red-600 text-center">No se pudo generar el PDF. Intenta de nuevo.</p>}
            </>
          )}
          {view.companyPhone && (
            <a href={`tel:${view.companyPhone}`} className="flex items-center justify-center gap-2 text-sm text-brand-700 font-medium">
              <Phone size={16} /> Llamar a la clínica
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900 text-right">{value}</dd>
    </div>
  );
}
