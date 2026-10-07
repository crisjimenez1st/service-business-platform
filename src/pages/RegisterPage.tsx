import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { useAuth } from '../contexts/useAuth';

const INPUT =
  'w-full pl-10 pr-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500';

/** Crear cuenta (correo + contraseña). Después sigue /onboarding para crear el negocio. */
export default function RegisterPage() {
  const { user, loading, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Escribe tu correo.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSubmitting(true);
    const result = await signUp(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setCheckEmail(true);
      return;
    }
    navigate('/onboarding', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mb-3">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Crear cuenta</h1>
          <p className="text-sm text-slate-500 mt-1">Registra a tus clientes y no olvides avisarles cuándo volver.</p>
        </div>

        <Card>
          {checkEmail ? (
            <div className="text-center space-y-3">
              <p className="font-medium text-slate-900">Revisa tu correo</p>
              <p className="text-sm text-slate-600">
                Te enviamos un enlace a {email.trim()} para confirmar tu cuenta. Después de confirmarlo, inicia sesión.
              </p>
              <Link to="/login" className="inline-block text-sm text-brand-600 hover:text-brand-700 font-medium">
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={INPUT}
                    placeholder="tucorreo@negocio.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={INPUT}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" fullWidth size="lg" disabled={submitting}>
                {submitting ? 'Creando...' : 'Crear cuenta'}
              </Button>
            </form>
          )}
        </Card>

        {!checkEmail && (
          <p className="text-sm text-slate-500 text-center mt-4">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Iniciar sesión
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
