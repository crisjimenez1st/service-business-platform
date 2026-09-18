import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

/**
 * Cliente único de Supabase para toda la app. Lee las credenciales de
 * variables de entorno (Vite las expone en `import.meta.env`, deben
 * empezar con VITE_ para quedar disponibles en el bundle del cliente).
 *
 * SEGURIDAD: esto usa la ANON KEY, que es pública por diseño — la
 * protección real vive en las políticas de Row Level Security de cada
 * tabla (ver supabase/migrations/002_rls.sql), no en mantener esta
 * clave en secreto. La SERVICE ROLE KEY nunca debe usarse aquí ni en
 * ningún código que corra en el navegador.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y completa tus credenciales de Supabase (ver README).'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persiste la sesión en localStorage del navegador (comportamiento
    // por defecto de supabase-js) — esto es sesión/token, no datos de
    // negocio, así que no entra en la limpieza de localStorage de la
    // migración (ver ROADMAP, Fase P).
    persistSession: true,
    autoRefreshToken: true,
  },
});
