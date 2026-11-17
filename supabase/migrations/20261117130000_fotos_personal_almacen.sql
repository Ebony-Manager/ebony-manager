-- Almacén → Herramientas muestra la foto de quien tiene cada herramienta.
-- Decisión de Carlos (17 nov 2026): quien tiene Almacén puede VER (solo leer)
-- las fotos de perfil de empleados y contratistas. No cambia nada más.

create policy "employee_photos_almacen_read" on storage.objects for select to authenticated
  using (bucket_id = 'employee-photos' and private.has_module('almacen'));

create policy "contractor_photos_almacen_read" on storage.objects for select to authenticated
  using (bucket_id = 'contractor-photos' and private.has_module('almacen'));
