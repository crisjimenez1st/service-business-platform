-- ============================================================
-- 029: Registro de accesos a datos de pacientes
-- ============================================================
-- Deja constancia de quién abrió historial clínico, descargó o eliminó
-- un expediente. Solo el dueño lo puede consultar. El nombre del paciente
-- se guarda como copia para que el registro sobreviva si el paciente se
-- elimina. Idempotente.

create table if not exists public.record_access_log (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null,
  client_id   uuid,
  client_name text not null,
  kind        text not null check (kind in ('view_clinical', 'export', 'delete')),
  created_at  timestamptz not null default now()
);

create index if not exists record_access_log_company_idx
  on public.record_access_log (company_id, created_at desc);

alter table public.record_access_log enable row level security;

drop policy if exists record_access_log_select on public.record_access_log;
create policy record_access_log_select on public.record_access_log
  for select to authenticated
  using (public.has_role_in_company(company_id, array['owner']));
-- Sin políticas de escritura: solo las funciones de abajo escriben.

create or replace function public.log_record_access(
  p_company_id uuid,
  p_client_id  uuid,
  p_kind       text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if p_kind not in ('view_clinical', 'export', 'delete') then
    raise exception 'Tipo no válido' using errcode = '22023';
  end if;
  if p_kind = 'view_clinical' then
    if not public.has_role_in_company(p_company_id, array['owner', 'technician']) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif not public.has_role_in_company(p_company_id, array['owner']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select name into v_name from public.clients where id = p_client_id and company_id = p_company_id;
  if v_name is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Abrir el mismo historial varias veces seguidas cuenta como un solo acceso.
  if p_kind = 'view_clinical' and exists (
    select 1 from public.record_access_log
     where company_id = p_company_id and user_id = auth.uid() and client_id = p_client_id
       and kind = 'view_clinical' and created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.record_access_log (company_id, user_id, client_id, client_name, kind)
  values (p_company_id, auth.uid(), p_client_id, v_name, p_kind);
end;
$$;

create or replace function public.get_access_log(
  p_company_id uuid,
  p_limit      integer default 100
) returns table (
  created_at  timestamptz,
  kind        text,
  client_name text,
  user_email  text,
  user_role   text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role_in_company(p_company_id, array['owner']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select l.created_at, l.kind, l.client_name, u.email::text, m.role
      from public.record_access_log l
      left join auth.users u on u.id = l.user_id
      left join public.company_members m on m.user_id = l.user_id and m.company_id = l.company_id
     where l.company_id = p_company_id
     order by l.created_at desc
     limit least(greatest(p_limit, 1), 300);
end;
$$;

revoke all on function public.log_record_access(uuid, uuid, text) from public;
revoke all on function public.get_access_log(uuid, integer) from public;
grant execute on function public.log_record_access(uuid, uuid, text) to authenticated;
grant execute on function public.get_access_log(uuid, integer) to authenticated;
