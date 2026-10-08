-- ============================================================
-- 020: Registro clínico de cada atención
-- ============================================================
-- Un registro por cita: motivo de consulta, diagnóstico, tratamiento
-- realizado, receta/indicaciones y próximos pasos. Es información
-- sensible: solo la ven y escriben el dueño y los doctores
-- (rol technician). La recepción (office) NO tiene acceso.
-- Se escribe únicamente con la RPC save_visit_record.

create table visit_records (
  job_id uuid primary key references jobs(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  reason text,
  diagnosis text,
  treatment text,
  prescription text,
  next_steps text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_visit_records_client on visit_records (company_id, client_id);

alter table visit_records enable row level security;

create policy visit_records_select_clinical on visit_records
  for select
  using (has_role_in_company(company_id, array['owner', 'technician']));
-- Sin policies de INSERT/UPDATE/DELETE: solo la RPC escribe.

create or replace function save_visit_record(
  p_job_id uuid,
  p_reason text default null,
  p_diagnosis text default null,
  p_treatment text default null,
  p_prescription text default null,
  p_next_steps text default null
)
returns visit_records
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_company uuid;
  v_client uuid;
  v_status text;
  v_row public.visit_records;
begin
  if auth.uid() is null then
    raise exception 'No autenticado: se requiere una sesión activa';
  end if;

  select j.company_id, j.client_id, j.status into v_company, v_client, v_status
  from public.jobs j where j.id = p_job_id;

  if v_company is null then
    raise exception 'Cita no encontrada';
  end if;

  if not has_role_in_company(v_company, array['owner', 'technician']) then
    raise exception 'No autorizado para registrar atenciones en esta empresa';
  end if;

  if v_status = 'cancelled' then
    raise exception 'Una cita cancelada no admite registro clínico';
  end if;

  if length(coalesce(p_reason,'')) > 4000 or length(coalesce(p_diagnosis,'')) > 4000
     or length(coalesce(p_treatment,'')) > 4000 or length(coalesce(p_prescription,'')) > 4000
     or length(coalesce(p_next_steps,'')) > 4000 then
    raise exception 'El texto es demasiado largo (máximo 4000 caracteres por campo)';
  end if;

  insert into public.visit_records as vr (job_id, company_id, client_id, reason, diagnosis, treatment, prescription, next_steps, updated_by)
  values (p_job_id, v_company, v_client,
          nullif(btrim(p_reason), ''), nullif(btrim(p_diagnosis), ''), nullif(btrim(p_treatment), ''),
          nullif(btrim(p_prescription), ''), nullif(btrim(p_next_steps), ''), auth.uid())
  on conflict (job_id) do update set
    reason = excluded.reason,
    diagnosis = excluded.diagnosis,
    treatment = excluded.treatment,
    prescription = excluded.prescription,
    next_steps = excluded.next_steps,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function save_visit_record(uuid, text, text, text, text, text) from public;
grant execute on function save_visit_record(uuid, text, text, text, text, text) to authenticated;
