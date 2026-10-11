-- ============================================================
-- 027: Catálogo de servicios y precios del consultorio
-- ============================================================
-- Lista de lo que la clínica ofrece (limpieza, consulta, ortodoncia...),
-- con categoría (tipo de tratamiento) y precio. Al agendar una cita se
-- elige de esta lista y el precio se completa solo (se puede cambiar).
-- Solo dueño y recepción ven y editan precios. La página pública de
-- "pedir cita" usa los nombres de los servicios activos (sin precios).

create table clinic_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  service_key text generated always as (
    lower(regexp_replace(
      translate(trim(name), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
      '\s+', ' ', 'g'
    ))
  ) stored,
  category text,
  price numeric(12, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clinic_services_name_not_blank check (length(trim(name)) > 0),
  constraint clinic_services_name_len check (length(name) <= 120),
  constraint clinic_services_category_len check (category is null or length(category) <= 60),
  constraint clinic_services_price_nonneg check (price is null or price >= 0),
  constraint clinic_services_unique_name unique (company_id, service_key)
);

create index idx_clinic_services_company on clinic_services (company_id, active);

alter table clinic_services enable row level security;

create policy clinic_services_select on clinic_services
  for select using (has_role_in_company(company_id, array['owner', 'office']));
create policy clinic_services_insert on clinic_services
  for insert with check (has_role_in_company(company_id, array['owner', 'office']));
create policy clinic_services_update on clinic_services
  for update
  using (has_role_in_company(company_id, array['owner', 'office']))
  with check (has_role_in_company(company_id, array['owner', 'office']));
create policy clinic_services_delete on clinic_services
  for delete using (has_role_in_company(company_id, array['owner', 'office']));

grant select, insert, update, delete on clinic_services to authenticated;

-- La página pública usa el catálogo (solo activos); si aún no hay, las reglas de regreso.
create or replace function get_public_booking(p_token uuid)
returns table (
  company_name text,
  company_logo_url text,
  company_phone text,
  services text[]
)
language sql
security definer
stable
set search_path = public
as $$
  select
    co.name,
    co.logo_url,
    co.phone,
    case
      when exists (select 1 from public.clinic_services s where s.company_id = co.id and s.active) then
        (select array_agg(s.name order by s.category nulls last, s.name)
           from public.clinic_services s where s.company_id = co.id and s.active)
      else
        coalesce(
          (select array_agg(r.service_name order by r.service_name)
             from public.service_followup_rules r where r.company_id = co.id),
          '{}'::text[]
        )
    end
  from public.companies co
  where co.booking_token = p_token and co.booking_enabled;
$$;

revoke all on function get_public_booking(uuid) from public;
grant execute on function get_public_booking(uuid) to anon, authenticated;
