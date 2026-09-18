import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { useAuth } from '../contexts/useAuth';
import { t } from '../i18n/es';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();

  // Mientras se resuelve la sesión inicial no se decide nada todavía
  // -- evita mostrar el formulario de login por un instante a alguien
  // que en realidad ya tiene sesión activa (recarga de página).
  if (loading) return null;

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mb-3">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{t.login.title}</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">{t.login.subtitle}</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t.login.email}
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
                  placeholder="tucorreo@empresa.ni"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t.login.password}
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" disabled={submitting}>
              {t.login.submit}
            </Button>

            <button
              type="button"
              className="w-full text-center text-sm text-brand-600 hover:text-brand-700 min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
            >
              {t.login.forgot}
            </button>
          </form>
        </Card>

        <p className="text-sm text-slate-500 text-center mt-4">
          {t.login.noAccount}{' '}
          <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium">
            {t.login.createAccount}
          </Link>
        </p>
      </div>
    </div>
  );
}
