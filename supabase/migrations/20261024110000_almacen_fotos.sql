-- Fotos de los productos del Almacén. Bucket PÚBLICO: son fotos de
-- catálogo (bisagras, tornillos…), sin datos sensibles, y así la tienda de
-- Salidas las muestra sin firmar 100 URLs en cada carga. Solo Compras sube,
-- cambia o borra.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventory-photos', 'inventory-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "inventory_photos_read" on storage.objects for select to authenticated
  using (bucket_id = 'inventory-photos');
create policy "inventory_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'inventory-photos' and private.has_module('almacen_compras'));
create policy "inventory_photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'inventory-photos' and private.has_module('almacen_compras'))
  with check (bucket_id = 'inventory-photos' and private.has_module('almacen_compras'));
create policy "inventory_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'inventory-photos' and private.has_module('almacen_compras'));
