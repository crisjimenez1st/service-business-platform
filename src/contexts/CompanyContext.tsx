import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { CompanyContext, type CurrentCompany } from './companyContextDefinition';

/**
 * Resuelve la empresa activa del usuario autenticado consultando
 * company_members y luego companies (dos queries explícitas, ver nota
 * de tipado dentro de loadCompany) -- nunca confía en un companyId que
 * el frontend ya tuviera guardado de una sesión anterior, siempre lo
 * pide de nuevo a la fuente de verdad real.
 *
 * Fase 2.5 asume un usuario -> una empresa activa (la primera
 * membresía activa encontrada). La arquitectura ya está preparada
 * para múltiples empresas por usuario: la query a company_members
 * puede traer más de una fila (hoy se toma solo la primera con
 * .limit(1)); el día que se soporte cambiar de empresa activa, este
 * mismo provider expondría la lista completa y un switchCompany(id)
 * en vez de tomar solo la primera -- sin tocar cómo el resto de la
 * app consume useCurrentCompany().company.id.
 *
 * El companyId resuelto aquí se usa en el frontend solo para
 * construir queries convenientes. La protección real es RLS en el
 * servidor -- este valor nunca debe tratarse como mecanismo de
 * seguridad por sí mismo.
 */
export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [company, setCompany] = useState<CurrentCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCompany() {
    if (!user) {
      setCompany(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Dos queries separadas en vez de un join embebido
    // (.select('role, companies(...)')): sin tipos de relaciones
    // generados por la CLI de Supabase (database.types.ts aquí es
    // escrito a mano, ver ese archivo), TypeScript no puede inferir
    // correctamente la forma del resultado de un join embebido y lo
    // reduce a `never`. Dos queries explícitas son un poco más
    // verbosas pero completamente tipadas sin depender de inferencia
    // frágil -- y siguen siendo dos llamadas rápidas indexadas
    // (company_members por user_id+status, companies por id).
    const { data: membership, error: membershipError } = await supabase
      .from('company_members')
      .select('role, company_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      setError('No pudimos cargar tu empresa. Intenta nuevamente.');
      setCompany(null);
      setLoading(false);
      return;
    }

    if (!membership) {
      // Usuario autenticado sin ninguna empresa activa todavía --
      // caso esperado justo después de registrarse, antes de
      // completar el flujo de creación de empresa (Fase J).
      setCompany(null);
      setLoading(false);
      return;
    }

    const { data: companyRow, error: companyError } = await supabase
      .from('companies')
      .select('id, name, currency, logo_url, timezone')
      .eq('id', membership.company_id)
      .maybeSingle();

    if (companyError || !companyRow) {
      setError('No pudimos cargar tu empresa. Intenta nuevamente.');
      setCompany(null);
      setLoading(false);
      return;
    }

    setCompany({
      id: companyRow.id,
      name: companyRow.name,
      currency: companyRow.currency,
      logoUrl: companyRow.logo_url,
      timezone: companyRow.timezone,
      role: membership.role,
    });
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    loadCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  return (
    <CompanyContext.Provider value={{ company, loading: authLoading || loading, error, refresh: loadCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}
