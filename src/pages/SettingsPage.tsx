import { useState } from 'react';
import { Button, Card } from '../components/ui';
import BusinessTypePicker from '../components/settings/BusinessTypePicker';
import CurrencyPicker from '../components/settings/CurrencyPicker';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { setBusinessType, setCompanyCurrency } from '../services/companySetupService';
import type { BusinessType, CurrencyCode } from '../types';
import { t } from '../i18n/es';

/** Configuración mínima: tipo de negocio (solo owner). Cambiarlo solo cambia el lenguaje y el menú; no toca datos. */
export default function SettingsPage() {
  const { company, refresh } = useCurrentCompany();
  const [selected, setSelected] = useState<BusinessType | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!company) return null;
  const isOwner = company.role === 'owner';
  const current = selected ?? company.businessType;
  const currentCurrency = selectedCurrency ?? (company.currency as CurrencyCode);
  const changed = current !== company.businessType || currentCurrency !== company.currency;

  async function handleSave() {
    if (!company) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    if (current !== company.businessType) {
      const result = await setBusinessType(company.id, current);
      if (result.error) {
        setSaving(false);
        setError(result.error.message);
        return;
      }
    }
    if (currentCurrency !== company.currency) {
      const result = await setCompanyCurrency(company.id, currentCurrency);
      if (result.error) {
        setSaving(false);
        setError(result.error.message);
        await refresh();
        return;
      }
    }
    await refresh();
    setSelected(null);
    setSelectedCurrency(null);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t.nav.settings}</h1>

      <Card className="space-y-4">
        <div>
          <p className="text-sm text-slate-500">Negocio</p>
          <p className="font-semibold text-slate-900">{company.name}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Tipo de negocio</p>
          <p className="text-sm text-slate-500 mb-3">
            Cambia las palabras y el menú de la app (por ejemplo Paciente / Cita / Doctor). Tus datos no cambian.
          </p>
          <BusinessTypePicker
            value={current}
            onChange={(v) => {
              setSelected(v);
              setSaved(false);
            }}
            disabled={!isOwner || saving}
          />
          {!isOwner && (
            <p className="text-sm text-slate-500 mt-3">Solo el dueño del negocio puede cambiar esto.</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Moneda por defecto</p>
          <p className="text-sm text-slate-500 mb-3">
            Se usa en los trabajos nuevos. Los trabajos que ya existen conservan su moneda.
          </p>
          <CurrencyPicker
            value={currentCurrency}
            onChange={(v) => {
              setSelectedCurrency(v);
              setSaved(false);
            }}
            disabled={!isOwner || saving}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {saved && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">Guardado.</p>}

        {isOwner && (
          <Button onClick={handleSave} disabled={!changed || saving}>
            {saving ? t.common.loading : 'Guardar cambios'}
          </Button>
        )}
      </Card>
    </div>
  );
}
