/**
 * ⚠️ OBSOLETO — sin consumidores desde la migración a Supabase Auth
 * (Fase 2.5). Reemplazado por:
 *   - src/contexts/AuthContext.tsx + useAuth() → sesión real
 *   - src/contexts/CompanyContext.tsx + useCurrentCompany() → empresa activa
 * Se mantiene el archivo (no se elimina) solo como referencia histórica
 * del contrato de Fase 1; puede eliminarse con seguridad en una limpieza
 * futura. No importar desde código nuevo.
 */
import { create } from 'zustand';
import type { User, Company } from '../types';
import * as db from '../services/localDb';
import { TABLES } from '../services/tables';

interface AuthState {
  currentUser: User | null;
  currentCompany: Company | null;
  isAuthenticated: boolean;
  login: (email: string) => { success: boolean; error?: string };
  logout: () => void;
  restoreSession: () => void;
}

const SESSION_KEY = 'camsaas_v1_session_userId';

/**
 * Fase 1: login "demo" — valida solo que el email exista entre los
 * usuarios semilla (cualquier contraseña es aceptada). Al conectar
 * Supabase Auth, `login` se reemplaza por una llamada real; el resto
 * de la app (rutas protegidas, permisos) no cambia.
 */
export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  currentCompany: null,
  isAuthenticated: false,

  login: (email: string) => {
    const users = db.getAll<User>(TABLES.users);
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.active);
    if (!user) {
      return { success: false, error: 'Correo no encontrado. Verifica tus datos.' };
    }
    const company = db.getById<Company>(TABLES.companies, user.companyId);
    localStorage.setItem(SESSION_KEY, user.id);
    set({ currentUser: user, currentCompany: company ?? null, isAuthenticated: true });
    return { success: true };
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    set({ currentUser: null, currentCompany: null, isAuthenticated: false });
  },

  restoreSession: () => {
    const userId = localStorage.getItem(SESSION_KEY);
    if (!userId) return;
    const user = db.getById<User>(TABLES.users, userId);
    if (!user) return;
    const company = db.getById<Company>(TABLES.companies, user.companyId);
    set({ currentUser: user, currentCompany: company ?? null, isAuthenticated: true });
  },
}));
