-- Settings → Cotizaciones → Datos de la empresa: el logo que sale en la
-- cotización para el cliente y en su PDF (en lugar del que está en el
-- código). La ruta y su tamaño van en app_settings ('company'); el archivo,
-- en este bucket privado: lo leen todos los usuarios (sale en cada
-- cotización), solo el admin lo sube o lo quita.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "branding_read" on storage.objects;
create policy "branding_read" on storage.objects for select to authenticated
  using (bucket_id = 'branding');
drop policy if exists "branding_admin_insert" on storage.objects;
create policy "branding_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and private.is_admin());
drop policy if exists "branding_admin_delete" on storage.objects;
create policy "branding_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and private.is_admin());
