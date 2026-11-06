-- Cotizador: imágenes de referencia por ítem (hasta 3): pantallazo de
-- SketchUp, de un plano o una referencia, o la vista 3D del ítem. Se ven al
-- lado del ítem en la vista para el cliente y en el PDF.

create table if not exists public.quote_section_images (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.quote_sections (id) on delete cascade,
  path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists quote_section_images_section_idx on public.quote_section_images (section_id, sort_order);

alter table public.quote_section_images enable row level security;
drop policy if exists "quote_section_images_all" on public.quote_section_images;
create policy "quote_section_images_all" on public.quote_section_images for all to authenticated
  using (private.has_module('cotizacion')) with check (private.has_module('cotizacion'));

-- Una cotización enviada, aprobada o rechazada no cambia (tampoco sus imágenes).
drop trigger if exists quote_section_images_locked_guard on public.quote_section_images;
create trigger quote_section_images_locked_guard before insert or update or delete on public.quote_section_images
  for each row execute function private.quote_child_locked_guard();

-- Archivos: bucket privado, solo quien cotiza.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-images', 'quote-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "quote_images_read" on storage.objects;
create policy "quote_images_read" on storage.objects for select to authenticated
  using (bucket_id = 'quote-images' and private.has_module('cotizacion'));
drop policy if exists "quote_images_insert" on storage.objects;
create policy "quote_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'quote-images' and private.has_module('cotizacion'));
drop policy if exists "quote_images_delete" on storage.objects;
create policy "quote_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'quote-images' and private.has_module('cotizacion'));
