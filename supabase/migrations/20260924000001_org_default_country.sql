-- Fase 5.1: país por defecto de la organización para normalizar teléfonos (WhatsApp).
-- Código ISO 3166-1 alfa-2. Las organizaciones existentes quedan en 'AR' (default de la
-- columna) y las nuevas también: bootstrap_organization no lista la columna, así que
-- toma el default y no hace falta redefinirla.
alter table public.organizations
  add column default_country_code text not null default 'AR'
  check (default_country_code ~ '^[A-Z]{2}$');
