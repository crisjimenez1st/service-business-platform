-- ============================================================
-- 018: Prueba gratis de 30 días y plan pagado
-- ============================================================
-- trial_ends_at: fin de la prueba gratis. Las empresas nuevas reciben
--   30 días desde su creación; las existentes, 30 días desde hoy.
-- paid_until: hasta cuándo está pagado el plan (lo fija el administrador
--   de la plataforma a mano al recibir el pago; null = sin pago).
--
-- Ninguna de las dos columnas se puede modificar desde la app (un owner
-- tiene UPDATE sobre su empresa para moneda/nombre, y no debe poder
-- extender su propia prueba). El trigger las restaura si el cambio viene
-- de un usuario de la app; el administrador las cambia desde el SQL Editor.
-- La app NO bloquea el uso al vencer: solo avisa.

alter table companies
  add column trial_ends_at timestamptz not null default (now() + interval '30 days'),
  add column paid_until timestamptz;

comment on column companies.trial_ends_at is
  'Fin de la prueba gratis. Solo el administrador de la plataforma lo cambia (trigger protect_company_billing).';
comment on column companies.paid_until is
  'Hasta cuándo está pagado el plan. null = sin pago. Solo el administrador de la plataforma lo cambia.';

create or replace function protect_company_billing()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.trial_ends_at := old.trial_ends_at;
    new.paid_until := old.paid_until;
  end if;
  return new;
end;
$$;

create trigger trg_companies_protect_billing
  before update on companies
  for each row execute function protect_company_billing();
