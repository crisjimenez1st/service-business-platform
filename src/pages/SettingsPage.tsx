import { useState } from 'react';
import { Button, Card } from '../components/ui';
import BusinessTypePicker from '../components/settings/BusinessTypePicker';
import CurrencyPicker from '../components/settings/CurrencyPicker';
import ServiceRulesCard from '../components/settings/ServiceRulesCard';
import BookingLinkCard from '../components/settings/BookingLinkCard';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useAuth } from '../contexts/useAuth';
import { changePassword, setBusinessType, setCompanyCurrency, setCompanyName } from '../services/companySetupService';
import type { BusinessType, CurrencyCode } from '../types';
import { PLAN_PRICE_USD, TRIAL_DAYS, getPlanState } from '../config/plan';
import { formatLongDateInTimezone } from '../utils/timezone';
import { t } from '../i18n/es';

/** Configuración mínima: tipo de negocio (solo owner). Cambiarlo solo cambia el lenguaje y el menú; no toca datos. */
export default function SettingsPage() {
  const { company, refresh } = useCurrentCompany();
  const { user } = useAuth();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwRepeat, setPwRepeat] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
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

  const nameValue = nameDraft ?? company.name;

  async function handleSaveName() {
    if (!company) return;
    setNameSaving(true);
    setNameMsg(null);
    const result = await setCompanyName(company.id, nameValue);
    if (result.error) {
      setNameMsg({ ok: false, text: result.error.message });
    } else {
      await refresh();
      setNameDraft(null);
      setNameMsg({ ok: true, text: 'Nombre actualizado.' });
    }
    setNameSaving(false);
  }

  async function handleChangePassword() {
    setPwMsg(null);
    if (pwNew !== pwRepeat) {
      setPwMsg({ ok: false, text: 'La contraseña nueva y su repetición no coinciden.' });
      return;
    }
    setPwSaving(true);
    const result = await changePassword(user?.email ?? '', pwCurrent, pwNew);
    setPwSaving(false);
    if (result.error) {
      setPwMsg({ ok: false, text: result.error.message });
      return;
    }
    setPwCurrent('');
    setPwNew('');
    setPwRepeat('');
    setPwMsg({ ok: true, text: 'Contraseña cambiada.' });
  }

  const inputCls =
    'w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 disabled:bg-slate-50';
  const isClinic = company.businessType === 'dental' || company.businessType === 'medical';

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t.nav.settings}</h1>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Mi clínica</h2>
        <Card className="space-y-3">
          <div>
            <label htmlFor="clinic-name" className="block text-sm font-medium text-slate-700 mb-1">
              Nombre de la clínica o del médico
            </label>
            <input
              id="clinic-name"
              type="text"
              value={nameValue}
              onChange={(e) => {
                setNameDraft(e.target.value);
                setNameMsg(null);
              }}
              disabled={!isOwner || nameSaving}
              className={inputCls}
            />
            <p className="text-xs text-slate-500 mt-1">Es el nombre que ven tus pacientes en mensajes y recibos.</p>
          </div>
          {nameMsg && (
            <p
              role={nameMsg.ok ? 'status' : 'alert'}
              className={['text-sm rounded-lg px-3 py-2', nameMsg.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'].join(' ')}
            >
              {nameMsg.text}
            </p>
          )}
          {isOwner ? (
            <Button onClick={handleSaveName} disabled={nameSaving || nameValue.trim() === company.name || nameValue.trim().length < 2}>
              {nameSaving ? t.common.loading : 'Guardar nombre'}
            </Button>
          ) : (
            <p className="text-sm text-slate-500">Solo el dueño puede cambiar el nombre.</p>
          )}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Mi cuenta</h2>
        <Card className="space-y-3">
          <div>
            <p className="text-sm text-slate-500">Correo</p>
            <p className="font-medium text-slate-900 break-all">{user?.email}</p>
          </div>
          <p className="text-sm font-medium text-slate-700 pt-1">Cambiar contraseña</p>
          <input type="password" autoComplete="current-password" placeholder="Contraseña actual" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} className={inputCls} />
          <input type="password" autoComplete="new-password" placeholder="Contraseña nueva (mínimo 8 caracteres)" value={pwNew} onChange={(e) => setPwNew(e.target.value)} className={inputCls} />
          <input type="password" autoComplete="new-password" placeholder="Repite la contraseña nueva" value={pwRepeat} onChange={(e) => setPwRepeat(e.target.value)} className={inputCls} />
          {pwMsg && (
            <p
              role={pwMsg.ok ? 'status' : 'alert'}
              className={['text-sm rounded-lg px-3 py-2', pwMsg.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'].join(' ')}
            >
              {pwMsg.text}
            </p>
          )}
          <Button onClick={handleChangePassword} disabled={pwSaving || !pwCurrent || !pwNew || !pwRepeat}>
            {pwSaving ? t.common.loading : 'Cambiar contraseña'}
          </Button>
        </Card>
      </section>

      <Card className="space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Tipo de clínica</p>
          <p className="text-sm text-slate-500 mb-3">
            Cambia las palabras de la app (Dentista o Médico). Tus datos no cambian.
          </p>
          <BusinessTypePicker
            value={current}
            onChange={(v) => {
              setSelected(v);
              setSaved(false);
            }}
            disabled={!isOwner || saving}
            allowed={isClinic ? ['dental', 'medical'] : undefined}
          />
          {!isOwner && (
            <p className="text-sm text-slate-500 mt-3">Solo el dueño del negocio puede cambiar esto.</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Moneda por defecto</p>
          <p className="text-sm text-slate-500 mb-3">
            Se usa en las citas y cobros nuevos. Los que ya existen conservan su moneda.
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

      {isOwner && (() => {
        const plan = getPlanState(company.trialEndsAt, company.paidUntil);
        return (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">Tu plan</h2>
            <Card>
              <p className="text-sm font-medium text-slate-900">
                {plan.kind === 'paid' && company.paidUntil
                  ? `Plan activo hasta el ${formatLongDateInTimezone(company.paidUntil, company.timezone)}`
                  : plan.kind === 'trial'
                    ? `Prueba gratis: te quedan ${plan.daysLeft} ${plan.daysLeft === 1 ? 'día' : 'días'}`
                    : 'Tu prueba gratis terminó'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Plan único: US${PLAN_PRICE_USD} al mes. El primer mes es gratis ({TRIAL_DAYS} días). Todo lo que ya registraste se conserva.
              </p>
            </Card>
          </section>
        );
      })()}

      {(isOwner || company.role === 'office') && company.businessType !== 'technical_services' && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900">Enlace para pedir cita</h2>
          <BookingLinkCard />
        </section>
      )}

      {(isOwner || company.role === 'office') && company.businessType !== 'technical_services' && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900">Reglas de regreso</h2>
          <ServiceRulesCard />
        </section>
      )}
    </div>
  );
}
