import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card } from '../ui';
import AuthShell from '../brand/AuthShell';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';

/** Pantalla que pide el código de 6 dígitos de la app autenticadora antes de entrar. */
export default function MfaChallenge() {
  const { signOut, refreshMfa } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const factors = await supabase.auth.mfa.listFactors();
    const factor = factors.data?.totp.find((f) => f.status === 'verified');
    if (!factor) {
      setBusy(false);
      setError('No encontramos tu verificación en dos pasos. Cierra sesión e intenta de nuevo.');
      return;
    }
    const result = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    setBusy(false);
    if (result.error) {
      setError('Código incorrecto o vencido. Revisa tu app e intenta de nuevo.');
      return;
    }
    await refreshMfa();
  }

  return (
    <AuthShell title="Verificación en dos pasos" subtitle="Escribe el código de tu app autenticadora.">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ShieldCheck size={18} className="text-brand-600 shrink-0" />
            Abre Google Authenticator (u otra app) y copia el código de 6 dígitos.
          </div>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-label="Código de 6 dígitos"
            placeholder="000000"
            autoFocus
            className="w-full text-center tracking-[0.5em] text-xl px-3 min-h-12 rounded-xl border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" fullWidth size="lg" disabled={busy || code.length !== 6}>
            {busy ? 'Verificando…' : 'Verificar y entrar'}
          </Button>
          <button type="button" onClick={signOut} className="w-full text-center text-sm text-slate-500 hover:text-slate-700 min-h-9">
            Cerrar sesión
          </button>
        </form>
      </Card>
    </AuthShell>
  );
}
