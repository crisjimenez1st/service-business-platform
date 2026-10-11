import { useEffect, useState } from 'react';
import { Sheet, Button } from '../ui';
import RateField from '../payments/RateField';
import { useRateInput } from '../../hooks/useRateInput';
import { useClinicServices } from '../../hooks/useClinicServices';
import { changeCompanyCurrency } from '../../services/companySetupService';
import { convertAmount, formatRateDate } from '../../utils/exchange';
import { formatCurrency } from '../../utils/currency';
import type { CurrencyCode } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  from: CurrencyCode;
  to: CurrencyCode;
  /** Se llama tras convertir con éxito. */
  onDone: () => void;
}

const NAME: Record<CurrencyCode, string> = { NIO: 'córdobas', USD: 'dólares' };

/** Confirma el cambio de moneda mostrando la tasa del BCN y cómo quedarán los precios. Se monta solo al abrir. */
export default function CurrencyChangeSheet({ open, onClose, companyId, from, to, onDone }: Props) {
  const rate = useRateInput();
  const services = useClinicServices().filter((s) => s.price != null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchRate } = rate;

  useEffect(() => {
    if (open) {
      (async () => {
        await fetchRate();
      })();
    }
  }, [open, fetchRate]);

  const eff = rate.effective;
  const sample = services.slice(0, 3);

  async function confirm() {
    if (!eff) return;
    setSaving(true);
    setError(null);
    const r = await changeCompanyCurrency(companyId, to, eff);
    setSaving(false);
    if (r.error) {
      setError(r.error.message);
      return;
    }
    onDone();
  }

  return (
    <Sheet
      open={open}
      onClose={() => !saving && onClose()}
      title={`Cambiar a ${NAME[to]}`}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button fullWidth disabled={saving || !eff} onClick={confirm}>
            {saving ? 'Convirtiendo…' : 'Convertir y cambiar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Tu lista de precios pasará de {NAME[from]} a {NAME[to]} con la tasa oficial del día. Las citas, planes y pagos
          que ya registraste conservan su moneda original.
        </p>
        <RateField
          loading={rate.loading}
          error={rate.error}
          official={rate.official}
          manual={rate.manual}
          onManual={rate.setManual}
          onRetry={rate.fetchRate}
        />
        {eff && sample.length > 0 && (
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
            {sample.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-slate-700 truncate">{s.name}</span>
                <span className="shrink-0 text-slate-900">
                  {formatCurrency(s.price ?? 0, from)} →{' '}
                  <strong>
                    {formatCurrency(
                      to === 'NIO'
                        ? Math.round(convertAmount(s.price ?? 0, from, to, eff.rate))
                        : convertAmount(s.price ?? 0, from, to, eff.rate),
                      to
                    )}
                  </strong>
                </span>
              </div>
            ))}
          </div>
        )}
        {eff && (
          <p className="text-xs text-slate-500">
            {services.length} servicio(s) con precio se convertirán · tasa del {formatRateDate(eff.date)} (
            {eff.source === 'bcn' ? 'BCN' : 'manual'}).
          </p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Sheet>
  );
}
