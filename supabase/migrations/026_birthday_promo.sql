-- ============================================================
-- 026: Promoción de cumpleaños (sección Marketing)
-- ============================================================
-- Texto que la clínica ofrece a quien cumple años (p. ej. "10% de descuento
-- en tu próxima limpieza este mes"). Se incluye en el WhatsApp de felicitación.
alter table companies
  add column birthday_promo text check (birthday_promo is null or length(birthday_promo) <= 300);
