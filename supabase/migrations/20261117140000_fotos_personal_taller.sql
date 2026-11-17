-- Taller muestra la foto de los responsables (empleados). Decisión de Carlos
-- (17 nov 2026): quien tiene Taller puede VER (solo leer) las fotos de perfil
-- de los empleados, igual que Almacén (20261117130000_fotos_personal_almacen.sql).

create policy "employee_photos_taller_read" on storage.objects for select to authenticated
  using (bucket_id = 'employee-photos' and private.has_module('taller'));
