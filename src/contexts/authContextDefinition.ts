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
  /** true cuando la cuenta tiene verificación en dos pasos y esta sesión aún no la ha completado. */
  mfaRequired: boolean;
  /** Vuelve a comprobar el nivel de verificación (tras activar, desactivar o verificar el código). */
  refreshMfa: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
