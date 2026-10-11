-- ============================================================
-- 028: Cambio de moneda con conversión de la lista de precios
-- ============================================================
-- Al cambiar la moneda de la clínica (córdobas <-> dólares), los precios
-- del catálogo de servicios se convierten con la tasa oficial del BCN del
-- día. La tasa la trae la app (función de Netlify) y la RPC la valida.
-- Solo se convierte el catálogo: citas, planes y pagos ya registrados
-- conservan la moneda con la que se crearon.
-- Idempotente: se puede ejecutar más de una vez.

create table if not exists public.currency_changes (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  from_currency      text not null check (from_currency in ('NIO', 'USD')),
  to_currency        text not null check (to_currency in ('NIO', 'USD')),
  rate               numeric(12, 6) not null check (rate > 0),
  rate_date          date not null,
  rate_source        text not null check (rate_source in ('bcn', 'manual')),
  services_converted integer not null default 0,
  changed_by         uuid references auth.users(id),
  created_at         timestamptz not null default now()
);

create index if not exists currency_changes_company_idx
  on public.currency_changes (company_id, created_at desc);

alter table public.currency_changes enable row level security;

drop policy if exists currency_changes_select on public.currency_changes;
create policy currency_changes_select on public.currency_changes
  for select to authenticated
  using (public.has_role_in_company(company_id, array['owner']));
-- Sin políticas de escritura: solo la RPC (security definer) inserta.

create or replace function public.change_company_currency(
  p_company_id  uuid,
  p_currency    text,
  p_rate        numeric,
  p_rate_date   date,
  p_rate_source text default 'bcn'
) returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company   public.companies;
  v_from      text;
  v_count     integer := 0;
begin
  if not public.has_role_in_company(p_company_id, array['owner']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_currency not in ('NIO', 'USD') then
    raise exception 'Moneda no válida' using errcode = '22023';
  end if;
  if p_rate is null or p_rate < 10 or p_rate > 200 then
    raise exception 'Tasa de cambio no válida' using errcode = '22023';
  end if;
  if p_rate_source not in ('bcn', 'manual') then
    raise exception 'Fuente de tasa no válida' using errcode = '22023';
  end if;

  select * into v_company from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_from := v_company.currency;
  if v_from = p_currency then
    return v_company;
  end if;

  if v_from = 'USD' and p_currency = 'NIO' then
    update public.clinic_services
       set price = round(price * p_rate)
     where company_id = p_company_id and price is not null;
  else
    update public.clinic_services
       set price = round(price / p_rate, 2)
     where company_id = p_company_id and price is not null;
  end if;
  get diagnostics v_count = row_count;

  update public.companies set currency = p_currency
   where id = p_company_id
   returning * into v_company;

  insert into public.currency_changes
    (company_id, from_currency, to_currency, rate, rate_date, rate_source, services_converted, changed_by)
  values
    (p_company_id, v_from, p_currency, p_rate, p_rate_date, p_rate_source, v_count, auth.uid());

  return v_company;
end;
$$;

revoke all on function public.change_company_currency(uuid, text, numeric, date, text) from public;
grant execute on function public.change_company_currency(uuid, text, numeric, date, text) to authenticated;
