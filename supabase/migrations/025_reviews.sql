-- ============================================================
-- 025: Reseñas — enlace de reseñas de la clínica y marca de "ya se le pidió"
-- ============================================================
alter table companies
  add column review_url text check (review_url is null or length(review_url) <= 500);

alter table clients
  add column review_asked_at timestamptz;
