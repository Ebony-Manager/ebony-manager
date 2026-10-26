-- Cotizador · gola dentro de puertas y gavetas
--
-- La gola (perfil de apertura sin tirador) se cotiza por metro lineal y
-- ahora va DENTRO del renglón de la puerta o la gaveta, no como renglón
-- aparte: el renglón guarda cuántos ML lleva y a qué precio (copia del
-- catálogo, igual que el precio del renglón).
--
-- Precios del Excel "Cuadro de costos" (HOJA DE COTIZACION): gola para
-- gaveta 11.20 / 16.93 / 23.70 (aglomerado / pintada / chapilla) y gola
-- para puertas 11.20 / 16.93 (aglomeradas / pintadas). La hoja no trae
-- gola para puertas en chapilla: se usa el mismo 23.70 de la gaveta en
-- chapilla (ajustable en Costos).
--
-- Idempotente: se puede volver a correr.

alter table public.quote_lines
  add column if not exists gola_ml    numeric(10,3) not null default 0 check (gola_ml >= 0),
  add column if not exists gola_price numeric(14,4) not null default 0 check (gola_price >= 0);

comment on column public.quote_lines.gola_ml is 'Gola de la puerta o gaveta: metros lineales (0 = sin gola).';
comment on column public.quote_lines.gola_price is 'Precio por ML de la gola al momento de cotizar (copia del catálogo).';

insert into public.quote_catalog_items (code, category, finish, name, unit, price, shape, sort_order) values
  ('gav-go-ch', 'gavetas', 'chapilla',   'Gola para gaveta en chapilla',   'ml', 23.70, 'none', 125),
  ('pta-go-ag', 'puertas', 'aglomerado', 'Gola para puertas aglomeradas',  'ml', 11.20, 'none', 255),
  ('pta-go-pi', 'puertas', 'pintado',    'Gola para puertas pintadas',     'ml', 16.93, 'none', 256),
  ('pta-go-ch', 'puertas', 'chapilla',   'Gola para puertas en chapilla',  'ml', 23.70, 'none', 257)
on conflict (code) do nothing;
