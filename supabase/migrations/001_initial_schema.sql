-- 001_initial_schema.sql
--
-- Esquema inicial para Fase 2.5 (backend real con Supabase).
-- Crea las 9 tablas de negocio + profiles, sin RLS todavía (ver 002_rls.sql)
-- y sin las funciones/triggers de numeración (ver 003 y 005).
--
-- Orden de creación respeta las dependencias de foreign keys:
-- companies -> profiles -> company_members -> clients -> equipment
--   -> opportunities -> quotes -> quote_items -> job_drafts

-- ============================================================
-- EXTENSIONES
-- ============================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================
-- COMPANIES
-- ============================================================

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  phone text,
  whatsapp text,
  email text,
  address text,
  currency text not null default 'NIO',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table companies is 'Empresas (tenants) del SaaS. Cada empresa es un cliente del producto.';

-- ============================================================
-- PROFILES
-- ============================================================

-- Extiende auth.users con datos de perfil. NO duplica email/password
-- (eso vive en auth.users, gestionado por Supabase Auth) más allá de
-- una copia de email para conveniencia de queries/joins simples.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Datos de perfil de cada usuario autenticado. id = auth.users.id.';

-- ============================================================
-- COMPANY_MEMBERS
-- ============================================================

create table company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'office', 'technician')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_unique_membership unique (company_id, user_id)
);

comment on table company_members is
  'Tabla de autorización multiempresa: a qué empresa(s) pertenece cada usuario y con qué rol. Base de todas las políticas RLS.';

-- ============================================================
-- CLIENTS
-- ============================================================

create table clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  phone text not null,
  whatsapp text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- EQUIPMENT
-- ============================================================

create table equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  type text not null,
  brand text,
  model text,
  serial_number text,
  installed_at date,
  warranty_expires_at date,
  maintenance_interval_months integer,
  estimated_life_months integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- OPPORTUNITIES
-- ============================================================

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  estimated_value numeric(12, 2) not null default 0,
  status text not null default 'active'
    check (status in ('active', 'contacted', 'postponed', 'converted', 'discarded')),
  due_date date,
  last_contacted_at timestamptz,
  source_equipment_id uuid references equipment(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- QUOTES
-- ============================================================

create table quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  quote_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled')),
  issue_date date not null default current_date,
  expiration_date date not null,
  notes text,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  currency text not null default 'NIO',
  public_token uuid not null default gen_random_uuid(),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_unique_number_per_company unique (company_id, quote_number),
  constraint quotes_public_token_unique unique (public_token)
);

comment on column quotes.public_token is
  'Token no adivinable (uuid) para acceso público via /q/:publicToken. Único mecanismo de acceso público — nunca exponer company_id ni client_id en esa ruta.';

-- ============================================================
-- QUOTE_ITEMS
-- ============================================================

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- JOB_DRAFTS
-- ============================================================

create table job_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  quote_id uuid not null references quotes(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  description text,
  estimated_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_drafts_unique_quote unique (quote_id)
);

comment on constraint job_drafts_unique_quote on job_drafts is
  'Garantiza idempotencia a nivel de base de datos: nunca puede existir más de un JobDraft por cotización, sin depender de que la app verifique antes de insertar.';

-- ============================================================
-- ACTIVITY_LOG (opcional, ligero)
-- ============================================================

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table activity_log is
  'Registro ligero de eventos de negocio (opcional). No es un sistema de auditoría completo — ver deuda técnica en README.';
