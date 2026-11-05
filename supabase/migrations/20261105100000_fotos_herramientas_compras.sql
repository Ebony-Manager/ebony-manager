-- Fotos de herramientas: quien puede editar herramientas (Ajustes de inventario
-- o Compras) también puede subir y borrar su foto. Antes la foto pedía solo
-- Ajustes, y con Compras la edición funcionaba pero la foto daba error.
drop policy if exists "inventory_photos_tools_insert" on storage.objects;
create policy "inventory_photos_tools_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'inventory-photos' and name like 'tools/%'
              and (private.has_module('almacen_ajustes') or private.has_module('almacen_compras')));
drop policy if exists "inventory_photos_tools_delete" on storage.objects;
create policy "inventory_photos_tools_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'inventory-photos' and name like 'tools/%'
         and (private.has_module('almacen_ajustes') or private.has_module('almacen_compras')));
