-- ============================================================
-- 021: Historial médico del paciente
-- ============================================================
-- Datos que acompañan al paciente en todas sus citas: alergias,
-- enfermedades o antecedentes, medicamentos que toma y notas
-- importantes. Información sensible: solo la ven y escriben el dueño y
-- los doctores (rol technician); la recepción NO tiene acceso.
-- Se escribe únicamente con la RPC save_patient_medical_profile.

create table patient_medical_profiles (
  client_id uuid primary key references clients(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  allergies text,
  medical_history text,
  medications text,
  important_notes text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_patient_medical_profiles_company on patient_medical_profiles (company_id);

alter table patient_medical_profiles enable row level security;

create policy patient_medical_profiles_select_clinical on patient_medical_profiles
  for select
  using (has_role_in_company(company_id, array['owner', 'technician']));
-- Sin policies de INSERT/UPDATE/DELETE: solo la RPC escribe.

create or replace function save_patient_medical_profile(
  p_client_id uuid,
  p_allergies text default null,
  p_medical_history text default null,
  p_medications text default null,
  p_important_notes text default null
)
returns patient_medical_profiles
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_company uuid;
  v_row public.patient_medical_profiles;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select c.company_id into v_company from public.clients c where c.id = p_client_id;

  if v_company is null then
    raise exception 'Cliente no encontrado';
  end if;

  if not has_role_in_company(v_company, array['owner', 'technician']) then
    raise exception 'No autorizado para registrar el historial médico en esta empresa';
  end if;

  if length(coalesce(p_allergies,'')) > 4000 or length(coalesce(p_medical_history,'')) > 4000
     or length(coalesce(p_medications,'')) > 4000 or length(coalesce(p_important_notes,'')) > 4000 then
    raise exception 'El texto es demasiado largo (máximo 4000 caracteres por campo)';
  end if;

  insert into public.patient_medical_profiles as pm (client_id, company_id, allergies, medical_history, medications, important_notes, updated_by)
  values (p_client_id, v_company,
          nullif(btrim(p_allergies), ''), nullif(btrim(p_medical_history), ''),
          nullif(btrim(p_medications), ''), nullif(btrim(p_important_notes), ''), auth.uid())
  on conflict (client_id) do update set
    allergies = excluded.allergies,
    medical_history = excluded.medical_history,
    medications = excluded.medications,
    important_notes = excluded.important_notes,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function save_patient_medical_profile(uuid, text, text, text, text) from public;
grant execute on function save_patient_medical_profile(uuid, text, text, text, text) to authenticated;
