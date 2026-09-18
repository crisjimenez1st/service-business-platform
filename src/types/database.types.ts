/**
 * Tipos generados manualmente a partir del esquema SQL en
 * supabase/migrations/ (no hay Supabase CLI disponible en este
 * entorno para generarlos automáticamente con `supabase gen types`).
 *
 * IMPORTANTE: si alguna migración cambia una columna, este archivo
 * debe actualizarse a mano para que siga reflejando el esquema real.
 * Cuando el proyecto tenga CLI de Supabase disponible, reemplazar por:
 *   supabase gen types typescript --project-id <id> > src/types/database.types.ts
 *
 * Cada tabla incluye `Relationships: []`. Esto es obligatorio: el SDK
 * de @supabase/supabase-js (concretamente el tipo interno GenericTable
 * de @supabase/postgrest-js) exige esa propiedad para poder inferir
 * correctamente los tipos de retorno de .from(...).select(...). Sin
 * ella, TypeScript colapsa la inferencia genérica a `never` en tiempo
 * de build (visible con `tsc -b` / `vite build`, aunque `tsc --noEmit`
 * en modo rápido no siempre lo detecta). Se deja vacío deliberadamente
 * -- las relaciones (FKs) siguen existiendo en SQL; esta propiedad
 * vacía solo significa que este archivo no describe joins embebidos
 * tipados, y por eso los servicios de esta app usan queries separadas
 * en vez de `.select('col, otra_tabla(...)')` (ver CompanyContext.tsx).
 *
 * Este archivo es deliberadamente distinto de types/core.ts,
 * types/jobs.ts, etc. (los tipos de dominio que ya usa toda la UI):
 * aquí todo es snake_case (refleja columnas SQL), Row/Insert/Update
 * por tabla, y nada de esto se importa directamente en componentes —
 * cada servicio mapea entre esta forma y los tipos de dominio
 * (camelCase) que la UI ya conoce.
 */

export type QuoteStatusDb =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type OpportunityStatusDb = 'active' | 'contacted' | 'postponed' | 'converted' | 'discarded';

export type CompanyMemberRoleDb = 'owner' | 'office' | 'technician';
export type CompanyMemberStatusDb = 'active' | 'invited' | 'disabled';

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          phone: string | null;
          whatsapp: string | null;
          email: string | null;
          address: string | null;
          currency: string;
          logo_url: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          address?: string | null;
          currency?: string;
          logo_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };

      company_members: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          role: CompanyMemberRoleDb;
          status: CompanyMemberStatusDb;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          role: CompanyMemberRoleDb;
          status?: CompanyMemberStatusDb;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['company_members']['Insert']>;
        Relationships: [];
      };

      clients: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          phone: string;
          whatsapp: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          phone: string;
          whatsapp?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
        Relationships: [];
      };

      equipment: {
        Row: {
          id: string;
          company_id: string;
          client_id: string;
          type: string;
          brand: string | null;
          model: string | null;
          serial_number: string | null;
          installed_at: string | null;
          warranty_expires_at: string | null;
          maintenance_interval_months: number | null;
          estimated_life_months: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          client_id: string;
          type: string;
          brand?: string | null;
          model?: string | null;
          serial_number?: string | null;
          installed_at?: string | null;
          warranty_expires_at?: string | null;
          maintenance_interval_months?: number | null;
          estimated_life_months?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['equipment']['Insert']>;
        Relationships: [];
      };

      opportunities: {
        Row: {
          id: string;
          company_id: string;
          client_id: string;
          type: string;
          title: string;
          description: string | null;
          estimated_value: number;
          status: OpportunityStatusDb;
          due_date: string | null;
          last_contacted_at: string | null;
          source_equipment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          client_id: string;
          type: string;
          title: string;
          description?: string | null;
          estimated_value?: number;
          status?: OpportunityStatusDb;
          due_date?: string | null;
          last_contacted_at?: string | null;
          source_equipment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['opportunities']['Insert']>;
        Relationships: [];
      };

      quotes: {
        Row: {
          id: string;
          company_id: string;
          client_id: string;
          opportunity_id: string | null;
          quote_number: string;
          status: QuoteStatusDb;
          issue_date: string;
          expiration_date: string;
          notes: string | null;
          subtotal: number;
          discount: number;
          tax: number;
          total: number;
          currency: string;
          public_token: string;
          sent_at: string | null;
          viewed_at: string | null;
          accepted_at: string | null;
          rejected_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          client_id: string;
          opportunity_id?: string | null;
          quote_number: string;
          status?: QuoteStatusDb;
          issue_date?: string;
          expiration_date: string;
          notes?: string | null;
          subtotal?: number;
          discount?: number;
          tax?: number;
          total?: number;
          currency?: string;
          public_token?: string;
          sent_at?: string | null;
          viewed_at?: string | null;
          accepted_at?: string | null;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>;
        Relationships: [];
      };

      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          discount: number;
          subtotal: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          discount?: number;
          subtotal: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quote_items']['Insert']>;
        Relationships: [];
      };

      job_drafts: {
        Row: {
          id: string;
          company_id: string;
          quote_id: string;
          client_id: string;
          title: string;
          description: string | null;
          estimated_total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          quote_id: string;
          client_id: string;
          title: string;
          description?: string | null;
          estimated_total?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['job_drafts']['Insert']>;
        Relationships: [];
      };

      jobs: {
        Row: {
          id: string;
          company_id: string;
          client_id: string;
          quote_id: string | null;
          job_draft_id: string | null;
          assigned_technician_id: string | null;
          service_type: string;
          description: string | null;
          notes: string | null;
          status: string;
          scheduled_start_at: string | null;
          scheduled_end_at: string | null;
          address: string | null;
          maps_url: string | null;
          total: number | null;
          paid_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          client_id: string;
          quote_id?: string | null;
          job_draft_id?: string | null;
          assigned_technician_id?: string | null;
          service_type: string;
          description?: string | null;
          notes?: string | null;
          status?: string;
          scheduled_start_at?: string | null;
          scheduled_end_at?: string | null;
          address?: string | null;
          maps_url?: string | null;
          total?: number | null;
          paid_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
        Relationships: [];
      };

      job_photos: {
        Row: {
          id: string;
          job_id: string;
          company_id: string;
          stage: string;
          storage_path: string;
          taken_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          company_id: string;
          stage: string;
          storage_path: string;
          taken_at?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['job_photos']['Insert']>;
        Relationships: [];
      };

      job_materials: {
        Row: {
          id: string;
          job_id: string;
          company_id: string;
          name: string;
          quantity: number;
          unit: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          company_id: string;
          name: string;
          quantity?: number;
          unit?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['job_materials']['Insert']>;
        Relationships: [];
      };

      activity_log: {
        Row: {
          id: string;
          company_id: string;
          actor_user_id: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          actor_user_id?: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>;
        Relationships: [];
      };

      company_quote_sequences: {
        Row: {
          company_id: string;
          last_number: number;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          last_number?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['company_quote_sequences']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_company_for_current_user: {
        Args: { p_company_name: string };
        Returns: string;
      };
      create_quote_from_opportunity: {
        Args: {
          p_opportunity_id: string;
          p_items: {
            description: string;
            quantity: number;
            unit_price: number;
            discount?: number;
          }[];
          p_discount?: number;
          p_tax?: number;
          p_notes?: string | null;
          p_expiration_date?: string | null;
        };
        Returns: string;
      };
      create_quote: {
        Args: {
          p_client_id: string;
          p_items: {
            description: string;
            quantity: number;
            unit_price: number;
            discount?: number;
          }[];
          p_discount?: number;
          p_tax?: number;
          p_notes?: string | null;
          p_expiration_date?: string | null;
        };
        Returns: string;
      };
      update_quote_draft: {
        Args: {
          p_quote_id: string;
          p_client_id?: string | null;
          p_items?:
            | {
                description: string;
                quantity: number;
                unit_price: number;
                discount?: number;
              }[]
            | null;
          p_discount?: number | null;
          p_tax?: number | null;
          p_notes?: string | null;
          p_expiration_date?: string | null;
        };
        Returns: boolean;
      };
      create_job_draft: {
        Args: {
          p_quote_id: string;
          p_title: string;
          p_description?: string | null;
        };
        Returns: string;
      };
      get_public_quote_by_token: {
        Args: { p_public_token: string };
        Returns: {
          quote_number: string;
          status: QuoteStatusDb;
          issue_date: string;
          expiration_date: string;
          notes: string | null;
          subtotal: number;
          discount: number;
          tax: number;
          total: number;
          currency: string;
          client_name: string;
          company_name: string;
          company_logo_url: string | null;
          company_phone: string | null;
          items: {
            description: string;
            quantity: number;
            unit_price: number;
            discount: number;
            subtotal: number;
          }[];
        }[];
      };
      mark_public_quote_viewed: {
        Args: { p_public_token: string };
        Returns: boolean;
      };
      accept_public_quote: {
        Args: { p_public_token: string };
        Returns: boolean;
      };
      reject_public_quote: {
        Args: { p_public_token: string; p_reason?: string | null };
        Returns: boolean;
      };

      can_current_technician_access_job: {
        Args: { p_job_id: string; p_company_id: string };
        Returns: boolean;
      };
      get_my_assigned_jobs: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          client_id: string;
          client_name: string;
          client_phone: string;
          client_whatsapp: string | null;
          service_type: string;
          description: string | null;
          status: string;
          scheduled_start_at: string | null;
          scheduled_end_at: string | null;
          address: string | null;
          maps_url: string | null;
          notes: string | null;
        }[];
      };
      get_my_job_photos: {
        Args: { p_job_id: string };
        Returns: { id: string; stage: string; storage_path: string; taken_at: string }[];
      };
      get_my_job_materials: {
        Args: { p_job_id: string };
        Returns: { id: string; name: string; quantity: number; unit: string | null }[];
      };
      update_job_as_technician: {
        Args: { p_job_id: string; p_new_status?: string | null; p_notes?: string | null };
        Returns: { id: string; status: string; notes: string | null; updated_at: string }[];
      };
      create_job_from_job_draft: {
        Args: { p_job_draft_id: string; p_assigned_technician_id?: string | null };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      assign_job_technician: {
        Args: { p_job_id: string; p_technician_id?: string | null };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      schedule_job: {
        Args: { p_job_id: string; p_scheduled_start_at?: string | null; p_scheduled_end_at?: string | null };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      get_company_technicians: {
        Args: { p_company_id: string };
        Returns: { user_id: string; display_name: string | null; email: string | null }[];
      };
    };
    Enums: Record<string, never>;
  };
}
