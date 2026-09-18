import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';

/**
 * Protege rutas que requieren sesión activa de Supabase (ya no depende
 * del login demo de Fase 1/authStore). Mientras se resuelve la sesión
 * inicial (loading === true, típicamente solo en el primer render tras
 * recargar la página), no redirige a /login todavía -- hacerlo
 * causaría un parpadeo a /login seguido de vuelta a la ruta protegida
 * en cada recarga, mientras Supabase termina de leer la sesión
 * persistida.
 *
 * Base para futuro control por rol: se puede extender con un prop
 * `allowedRoles` que compare contra useCurrentCompany().company?.role.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
