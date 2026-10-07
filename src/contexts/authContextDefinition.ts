import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** true mientras se resuelve la sesión inicial (primer render tras recargar la página). */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** needsConfirmation = true cuando Supabase exige confirmar el correo antes de iniciar sesión (no hay sesión todavía). */
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
