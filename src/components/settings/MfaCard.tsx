import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card } from '../ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';

interface Enrollment {
  factorId: string;
  qr: string;
  secret: string;
}

const inputCls =
  'w-full px-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

/** Activar o desactivar la verificación en dos pasos (app autenticadora) de la cuenta. */
export default function MfaCard() {
  const { refreshMfa } = useAuth();
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);
  const [enroll, setEnroll] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await supabase.auth.mfa.listFactors();
    setFactorId(r.data?.totp.find((f) => f.status === 'verified')?.id ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function start() {
    setBusy(true);
    setMsg(null);
    // Limpia intentos anteriores que nunca se confirmaron.
    const all = await supabase.auth.mfa.listFactors();
    for (const f of all.data?.all ?? []) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const r = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'OneFlow Med' });
    setBusy(false);
    if (r.error || !r.data) {
      setMsg({ ok: false, text: 'No pudimos iniciar la activación. Intenta de nuevo en un momento.' });
      return;
    }
    setEnroll({ factorId: r.data.id, qr: r.data.totp.qr_code, secret: r.data.totp.secret });
    setCode('');
  }

  async function confirm() {
    if (!enroll) return;
    setBusy(true);
    setMsg(null);
    const r = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.factorId, code: code.trim() });
    setBusy(false);
    if (r.error) {
      setMsg({ ok: false, text: 'Código incorrecto. Revisa que la hora de tu teléfono sea la correcta e intenta de nuevo.' });
      return;
    }
    setEnroll(null);
    setMsg({ ok: true, text: 'Verificación en dos pasos activada.' });
    await load();
    await refreshMfa();
  }

  async function disable() {
    if (!factorId) return;
    setBusy(true);
    setMsg(null);
    const r = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (r.error) {
      setMsg({ ok: false, text: 'No pudimos desactivarla. Intenta de nuevo.' });
      return;
    }
    setMsg({ ok: true, text: 'Verificación en dos pasos desactivada.' });
    await load();
    await refreshMfa();
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-flow-lilac text-brand-700">
          <ShieldCheck size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Verificación en dos pasos</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Además de la contraseña, se pide un código de tu teléfono al entrar. Protege los expedientes si alguien
            consigue tu contraseña.
          </p>
        </div>
      </div>

      {factorId === undefined ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : enroll ? (
        <div className="space-y-3">
          <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1">
            <li>Abre Google Authenticator (u otra app de códigos) y escanea este QR.</li>
            <li>Escribe el código de 6 dígitos que muestra la app.</li>
          </ol>
          <img src={enroll.qr} alt="Código QR para la app autenticadora" className="h-40 w-40 rounded-xl border border-violet-100 bg-white p-2" />
          <p className="text-xs text-slate-500 break-all">¿No puedes escanear? Escribe esta clave en la app: <span className="font-mono">{enroll.secret}</span></p>
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="Código de 6 dígitos"
            aria-label="Código de 6 dígitos"
            className={inputCls}
          />
          <div className="flex gap-3">
            <Button variant="secondary" disabled={busy} onClick={() => setEnroll(null)}>
              Cancelar
            </Button>
            <Button disabled={busy || code.length !== 6} onClick={confirm}>
              {busy ? 'Verificando…' : 'Activar'}
            </Button>
          </div>
        </div>
      ) : factorId ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-emerald-700">Activada</p>
          <Button variant="danger" size="sm" disabled={busy} onClick={disable}>
            Desactivar
          </Button>
        </div>
      ) : (
        <Button disabled={busy} onClick={start}>
          Activar verificación en dos pasos
        </Button>
      )}

      {msg && (
        <p role="alert" className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
          {msg.text}
        </p>
      )}
    </Card>
  );
}
