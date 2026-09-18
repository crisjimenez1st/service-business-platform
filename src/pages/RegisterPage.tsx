import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Card } from '../components/ui';

/**
 * Placeholder deliberado: el flujo completo de registro + creación de
 * empresa (RPC create_company_for_current_user) es la Fase J del plan
 * de migración a Supabase, todavía no construida en este bloque
 * (Auth + CompanyProvider). Existe esta página solo para que el link
 * "Crear cuenta" de LoginPage no sea un 404 mientras tanto.
 */
export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mb-3">
            <Shield size={28} className="text-white" />
          </div>
        </div>
        <Card>
          <p className="text-sm text-slate-600">
            El registro de nuevas empresas estará disponible próximamente.
          </p>
          <Link
            to="/login"
            className="inline-block mt-4 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Volver a iniciar sesión
          </Link>
        </Card>
      </div>
    </div>
  );
}
