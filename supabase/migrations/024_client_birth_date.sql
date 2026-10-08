-- ============================================================
-- 024: Fecha de nacimiento del paciente (para felicitar en su cumpleaños)
-- ============================================================
-- Opcional. Se edita con las políticas existentes de clients (owner/office).
alter table clients add column birth_date date;
alter table clients add constraint clients_birth_date_sane
  check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date));
