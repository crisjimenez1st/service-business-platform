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
          business_type: string;
          trial_ends_at: string;
          paid_until: string | null;
          booking_token: string;
          booking_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          booking_enabled?: boolean;
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
          contact_consent: boolean;
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
          contact_consent?: boolean;
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
          currency: string;
          due_date: string | null;
          cancellation_reason: string | null;
          cancellation_category: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
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
          currency?: string;
          due_date?: string | null;
          cancellation_reason?: string | null;
          cancellation_category?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
        Relationships: [];
      };

      service_followup_rules: {
        Row: {
          id: string;
          company_id: string;
          service_name: string;
          service_key: string;
          months: number;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          service_name: string;
          months: number;
          reason?: string | null;
        };
        Update: { service_name?: string; months?: number; reason?: string | null };
        Relationships: [];
      };

      /** Solo lectura desde el cliente: escribir pasa por add_to_waitlist / resolve_waitlist_entry. */
      waitlist_entries: {
        Row: {
          id: string;
          company_id: string;
          client_id: string;
          note: string | null;
          service: string | null;
          status: string;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      /** Solo lectura (owner/office): escribir pasa por las RPCs de planes de tratamiento. */
      treatment_plans: {
        Row: {
          id: string;
          company_id: string;
          client_id: string;
          name: string;
          description: string | null;
          total: number;
          paid_amount: number;
          currency: string;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      plan_payments: {
        Row: {
          id: string;
          plan_id: string;
          company_id: string;
          amount: number;
          method: string;
          paid_at: string;
          note: string | null;
          recorded_by: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      /** Solo lectura (owner/doctor): escribir pasa por save_patient_medical_profile. */
      patient_medical_profiles: {
        Row: {
          client_id: string;
          company_id: string;
          allergies: string | null;
          medical_history: string | null;
          medications: string | null;
          important_notes: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      /** Solo lectura (owner/doctor): escribir pasa por save_visit_record. */
      visit_records: {
        Row: {
          job_id: string;
          company_id: string;
          client_id: string;
          reason: string | null;
          diagnosis: string | null;
          treatment: string | null;
          prescription: string | null;
          next_steps: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      /** Solo lectura (owner/office): escribir pasa por las RPCs de recordatorio de cita. */
      appointment_responses: {
        Row: {
          job_id: string;
          company_id: string;
          token: string;
          response: string | null;
          response_at: string | null;
          response_source: string | null;
          reminded_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      payments: {
        Row: {
          id: string;
          company_id: string;
          job_id: string;
          amount: number;
          payment_type: string;
          method: string;
          paid_at: string;
          reference: string | null;
          note: string | null;
          recorded_by: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          created_at: string;
        };
        /** Solo lectura desde el cliente: escribir pasa siempre por record_payment/void_payment. */
        Insert: never;
        Update: never;
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

      appointment_requests: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          phone: string;
          phone_key: string;
          service: string;
          preferred: string | null;
          note: string | null;
          status: string;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: never;
        Update: never;
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
        Args: { p_company_name: string; p_business_type?: string };
        Returns: string;
      };
      set_company_business_type: {
        Args: { p_company_id: string; p_business_type: string };
        Returns: Database['public']['Tables']['companies']['Row'];
      };
      get_followups_due: {
        Args: { p_company_id: string };
        Returns: {
          opportunity_id: string;
          client_id: string;
          client_name: string;
          client_phone: string;
          client_whatsapp: string | null;
          category: string;
          title: string;
          reason: string | null;
          status: string;
          due_date: string;
          days_overdue: number;
          last_contacted_at: string | null;
          last_visit_at: string | null;
        }[];
      };
      get_inactive_clients: {
        Args: { p_company_id: string; p_months?: number };
        Returns: {
          client_id: string;
          client_name: string;
          client_phone: string;
          client_whatsapp: string | null;
          last_visit_at: string;
          days_since_visit: number;
        }[];
      };
      resolve_inactive_client: {
        Args: { p_company_id: string; p_client_id: string; p_action: string; p_date?: string | null };
        Returns: string;
      };
      add_to_waitlist: {
        Args: { p_company_id: string; p_client_id: string; p_note?: string | null; p_service?: string | null };
        Returns: string;
      };
      resolve_waitlist_entry: {
        Args: { p_entry_id: string; p_status: string };
        Returns: undefined;
      };
      prepare_appointment_link: {
        Args: { p_job_id: string };
        Returns: string;
      };
      mark_appointment_reminded: {
        Args: { p_job_id: string };
        Returns: undefined;
      };
      set_appointment_response: {
        Args: { p_job_id: string; p_response: string | null };
        Returns: undefined;
      };
      get_public_booking: {
        Args: { p_token: string };
        Returns: {
          company_name: string;
          company_logo_url: string | null;
          company_phone: string | null;
          services: string[] | null;
        }[];
      };
      submit_appointment_request: {
        Args: {
          p_token: string;
          p_name: string;
          p_phone: string;
          p_service: string;
          p_preferred?: string | null;
          p_note?: string | null;
        };
        Returns: string;
      };
      resolve_appointment_request: {
        Args: { p_id: string; p_status: string };
        Returns: Database['public']['Tables']['appointment_requests']['Row'];
      };
      get_public_appointment: {
        Args: { p_token: string };
        Returns: {
          company_name: string;
          company_logo_url: string | null;
          company_phone: string | null;
          client_first_name: string;
          scheduled_start_at: string;
          timezone: string;
          response: string | null;
          can_respond: boolean;
        }[];
      };
      respond_public_appointment: {
        Args: { p_token: string; p_response: string };
        Returns: string;
      };
      create_client_with_followup: {
        Args: {
          p_company_id: string;
          p_name: string;
          p_phone: string;
          p_whatsapp?: string | null;
          p_contact_consent?: boolean;
          p_followup_due_date?: string | null;
          p_followup_title?: string | null;
          p_followup_reason?: string | null;
        };
        Returns: Database['public']['Tables']['clients']['Row'];
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
      create_appointment: {
        Args: {
          p_company_id: string;
          p_client_id: string;
          p_service: string;
          p_scheduled_start_at: string;
          p_scheduled_end_at?: string | null;
          p_total?: number | null;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      create_treatment_plan: {
        Args: {
          p_company_id: string;
          p_client_id: string;
          p_name: string;
          p_total: number;
          p_description?: string | null;
          p_initial_payment?: number | null;
          p_method?: string;
        };
        Returns: Database['public']['Tables']['treatment_plans']['Row'];
      };
      record_plan_payment: {
        Args: { p_plan_id: string; p_amount: number; p_method?: string; p_paid_at?: string; p_note?: string | null };
        Returns: Database['public']['Tables']['treatment_plans']['Row'];
      };
      void_plan_payment: {
        Args: { p_payment_id: string; p_void_reason: string };
        Returns: Database['public']['Tables']['treatment_plans']['Row'];
      };
      set_treatment_plan_status: {
        Args: { p_plan_id: string; p_status: string };
        Returns: Database['public']['Tables']['treatment_plans']['Row'];
      };
      save_patient_medical_profile: {
        Args: {
          p_client_id: string;
          p_allergies?: string | null;
          p_medical_history?: string | null;
          p_medications?: string | null;
          p_important_notes?: string | null;
        };
        Returns: Database['public']['Tables']['patient_medical_profiles']['Row'];
      };
      save_visit_record: {
        Args: {
          p_job_id: string;
          p_reason?: string | null;
          p_diagnosis?: string | null;
          p_treatment?: string | null;
          p_prescription?: string | null;
          p_next_steps?: string | null;
        };
        Returns: Database['public']['Tables']['visit_records']['Row'];
      };
      prepare_payment_receipt: {
        Args: { p_payment_id: string };
        Returns: string;
      };
      get_public_receipt: {
        Args: { p_token: string };
        Returns: {
          company_name: string;
          company_logo_url: string | null;
          company_phone: string | null;
          client_first_name: string;
          service_name: string;
          amount: number | null;
          currency: string;
          method: string;
          paid_at: string;
          timezone: string;
          job_total: number | null;
          balance: number | null;
          receipt_code: string;
          voided: boolean;
        }[];
      };
      schedule_job: {
        Args: { p_job_id: string; p_scheduled_start_at?: string | null; p_scheduled_end_at?: string | null };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      get_company_technicians: {
        Args: { p_company_id: string };
        Returns: { user_id: string; display_name: string | null; email: string | null }[];
      };
      cancel_job: {
        Args: { p_job_id: string; p_reason: string; p_category?: string | null };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      set_job_financial_terms: {
        Args: { p_job_id: string; p_total: number; p_due_date?: string | null };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      record_payment: {
        Args: {
          p_job_id: string;
          p_amount: number;
          p_payment_type: string;
          p_method: string;
          p_paid_at?: string;
          p_reference?: string | null;
          p_note?: string | null;
        };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      void_payment: {
        Args: { p_payment_id: string; p_void_reason: string };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
      get_job_payments: {
        Args: { p_job_id: string };
        Returns: {
          id: string;
          amount: number;
          payment_type: string;
          method: string;
          paid_at: string;
          reference: string | null;
          note: string | null;
          recorded_by: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          created_at: string;
        }[];
      };
      get_company_receivables: {
        Args: { p_company_id: string };
        Returns: {
          job_id: string;
          client_id: string;
          client_name: string;
          service_type: string;
          status: string;
          total: number;
          paid_amount: number;
          balance: number;
          currency: string;
          due_date: string | null;
          payment_status: string;
          is_overdue: boolean;
          requires_review: boolean;
        }[];
      };
      get_receivables_summary: {
        Args: { p_company_id: string };
        Returns: {
          currency: string;
          outstanding: number;
          overdue_amount: number;
          overdue_count: number;
          open_count: number;
        }[];
      };
      get_unpriced_jobs: {
        Args: { p_company_id: string };
        Returns: {
          job_id: string;
          client_id: string;
          client_name: string;
          service_type: string;
          updated_at: string;
        }[];
      };
      advance_job_status: {
        Args: { p_job_id: string; p_new_status: string };
        Returns: Database['public']['Tables']['jobs']['Row'];
      };
    };
    Enums: Record<string, never>;
  };
}
