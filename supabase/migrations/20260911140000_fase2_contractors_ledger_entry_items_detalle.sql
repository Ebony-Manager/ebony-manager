-- Fase 2 — Contratistas · detalle de pieza por ítem de trabajo
--
-- Objetivo: un mismo proyecto puede facturar el mismo ítem del catálogo
-- (ej. "M² pintado liso") varias veces para piezas distintas (ej. un
-- mueble de TV y un mueble de recámara). `detalle` es una nota de texto
-- libre y OPCIONAL para anotar a qué pieza corresponde esa línea — se
-- congela junto con el resto del ítem (mismo criterio que descripcion/
-- fase/unidad/precio_unitario_cents en 20260911130000).
--
-- Aditivo: columna nullable, sin default, no reescribe filas existentes.
--
-- Aplicada el 2026-09-11 vía el MCP de Supabase (proyecto Ebony).

alter table public.contractor_ledger_entry_items
  add column detalle text;

comment on column public.contractor_ledger_entry_items.detalle is
  'Nota opcional de la pieza específica de mueble a la que corresponde esta línea (ej. "Mueble de TV"). Texto libre, congelado igual que el resto del ítem.';
