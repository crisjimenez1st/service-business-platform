import { PASSWORD_HINT, validatePassword } from '../utils/password';
import AuthShell from '../components/brand/AuthShell';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
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
  const [accepted, setAccepted] = useState(false);
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
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (!accepted) {
      setError('Para crear tu cuenta acepta los Términos y la Política de privacidad.');
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
    <AuthShell title="Crear cuenta" subtitle="Empieza gratis y deja tu clínica en un solo flujo.">
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
                    placeholder={PASSWORD_HINT}
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
                />
                <span>
                  Acepto los{' '}
                  <Link to="/terminos" target="_blank" className="text-brand-600 font-medium underline">
                    Términos de uso
                  </Link>{' '}
                  y la{' '}
                  <Link to="/privacidad" target="_blank" className="text-brand-600 font-medium underline">
                    Política de privacidad
                  </Link>
                  .
                </span>
              </label>

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
    </AuthShell>
  );
}
