import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Button, Card } from '../components/ui';
import BusinessTypePicker from '../components/settings/BusinessTypePicker';
import { useAuth } from '../contexts/useAuth';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { createCompany } from '../services/companySetupService';
import type { BusinessType } from '../types';

/** Primer paso de una cuenta nueva: nombre del negocio + tipo (decide el lenguaje y el menú). */
export default function OnboardingPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { company, loading: companyLoading, refresh } = useCurrentCompany();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading || companyLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (company) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Escribe el nombre de tu negocio.');
      return;
    }
    if (!type) {
      setError('Elige qué tipo de negocio tienes.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createCompany(name.trim(), type);
    if (result.error) {
      setSaving(false);
      setError(result.error.message);
      return;
    }
    await refresh();
    setSaving(false);
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mb-3">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Cuéntanos de tu negocio</h1>
          <p className="text-sm text-slate-500 mt-1">Tarda un minuto. Podrás cambiarlo después en Configuración.</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="business-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Nombre del negocio
              </label>
              <input
                id="business-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
                placeholder="Ej. Clínica Sonrisa"
              />
            </div>

            <div>
              <p className="block text-sm font-medium text-slate-700 mb-2">¿Qué tipo de negocio es?</p>
              <BusinessTypePicker value={type} onChange={setType} disabled={saving} />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" disabled={saving}>
              {saving ? 'Creando...' : 'Empezar'}
            </Button>
          </form>
        </Card>

        <button
          type="button"
          onClick={() => signOut()}
          className="block mx-auto mt-4 text-sm text-slate-500 hover:text-slate-700 min-h-9"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
