import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthContext, type AuthContextValue } from './authContextDefinition';

/**
 * Fuente única de verdad de sesión: Supabase Auth (email + password).
 * Reemplaza el login demo de Fase 1 (authStore.login, que solo
 * comprobaba que el email existiera en datos semilla sin validar
 * contraseña real) — ProtectedRoute y toda la app ahora dependen de
 * una sesión JWT real emitida por Supabase, no de un flag local.
 *
 * Preparado para social login futuro (Google/Apple): supabase-js ya
 * soporta signInWithOAuth({ provider: 'google' | 'apple' }); no se
 * implementa todavía (fuera de alcance de Fase 2.5) pero el provider
 * no necesita cambiar de forma para agregarlo — solo se sumaría un
 * método más junto a signIn/signUp.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaTick, setMfaTick] = useState(0);

  useEffect(() => {
    // Resuelve la sesión ya persistida (Supabase la guarda en
    // localStorage por defecto) antes de mostrar cualquier ruta
    // protegida, para no parpadear a /login en cada recarga de página.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // onAuthStateChange cubre login, logout, refresh de token, y
    // login en otra pestaña del mismo navegador -- una sola
    // suscripción para todo el ciclo de vida de la sesión.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Con verificación en dos pasos activa, una sesión que solo puso la contraseña (aal1) debe pedir el código.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!cancelled) setMfaRequired(!!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, mfaTick]);

  async function refreshMfa(): Promise<void> {
    setMfaTick((n) => n + 1);
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }

  async function signUp(
    email: string,
    password: string
  ): Promise<{ error: string | null; needsConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error: error ? error.message : null, needsConfirmation: !error && !data.session };
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    mfaRequired: !!session && mfaRequired,
    refreshMfa,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
