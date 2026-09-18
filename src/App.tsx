import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientProfilePage from './pages/ClientProfilePage';
import OpportunitiesPage from './pages/OpportunitiesPage';
import QuotesPage from './pages/QuotesPage';
import QuoteFormPage from './pages/QuoteFormPage';
import QuoteDetailPage from './pages/QuoteDetailPage';
import QuotePublicPage from './pages/QuotePublicPage';
import CalendarPage from './pages/CalendarPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import ComingSoonPage from './pages/ComingSoonPage';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { t } from './i18n/es';

/**
 * App.tsx se mantiene deliberadamente pequeño: solo enrutamiento +
 * los providers de sesión/empresa que todo el árbol necesita.
 *
 * AuthProvider primero (resuelve sesión de Supabase), CompanyProvider
 * dentro (depende de useAuth() para saber quién es el usuario antes
 * de consultar company_members). Ya no hay seedDatabase()/
 * restoreSession() a nivel de módulo -- esa inicialización era del
 * mock de localStorage (Fase 1/2); la sesión real ahora la resuelve
 * AuthProvider en su propio efecto, y los datos de negocio vienen de
 * Supabase, no de un seed local.
 */
export default function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/*
              Ruta pública de cotización: SIN AppLayout (no sidebar, no
              bottom nav) y SIN ProtectedRoute (el cliente final no tiene
              sesión). El único control de acceso es el publicToken en la
              URL, validado en el backend vía get_public_quote_by_token.
            */}
            <Route path="/q/:publicToken" element={<QuotePublicPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:id" element={<ClientProfilePage />} />
                <Route path="/opportunities" element={<OpportunitiesPage />} />
                <Route path="/quotes" element={<QuotesPage />} />
                <Route path="/quotes/new" element={<QuoteFormPage />} />
                <Route path="/quotes/:id/edit" element={<QuoteFormPage />} />
                <Route path="/quotes/:id" element={<QuoteDetailPage />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/jobs/:id" element={<JobDetailPage />} />
                <Route path="/more" element={<ComingSoonPage title={t.nav.more} />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/technicians" element={<ComingSoonPage title={t.nav.technicians} />} />
                <Route path="/payments" element={<ComingSoonPage title={t.nav.payments} />} />
                <Route path="/equipment" element={<ComingSoonPage title={t.nav.equipment} />} />
                <Route path="/warranties" element={<ComingSoonPage title={t.nav.warranties} />} />
                <Route path="/reports" element={<ComingSoonPage title={t.nav.reports} />} />
                <Route path="/settings" element={<ComingSoonPage title={t.nav.settings} />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </CompanyProvider>
    </AuthProvider>
  );
}
