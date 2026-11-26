-- Inspecciones: el responsable de un detalle puede ser Ebony, el pintor o el cliente / tercero (proveedor, otro
-- contratista del cliente…). «tercero» se queda con su línea de quién.
alter table public.inspection_items drop constraint if exists inspection_items_responsible_check;
alter table public.inspection_items add constraint inspection_items_responsible_check
  check (responsible in ('ebony', 'pintor', 'tercero'));
