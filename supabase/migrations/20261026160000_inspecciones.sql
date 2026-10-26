-- Inspecciones de proyectos: la supervisora va a sitio, toma fotos y anota
-- detalles. Una inspección = una visita (proyecto, fecha, quién, nota); cada
-- visita tiene detalles (área, comentario, fotos) que nacen Pendientes y la
-- supervisora marca Resueltos. Se ven por visita o todo junto por proyecto,
-- y salen en PDF (por defecto solo lo pendiente) para el instalador.
--
-- Permiso nuevo: `inspecciones` (crear, editar, resolver). Puede leer la
-- lista de proyectos (nombre, cliente, ubicación), sin nada de dinero.
-- Fotos en un bucket PRIVADO (URLs firmadas).

alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'proyectos', 'planilla', 'asistencia', 'contratistas', 'documentos',
                          'almacen', 'almacen_compras', 'almacen_costos', 'almacen_ajustes', 'directorio',
                          'accesos', 'form_autorizaciones', 'form_registro', 'inspecciones']::text[]);

-- Proyectos: quien inspecciona ve solo nombre, cliente, ubicación y estado
-- (no las columnas de condiciones de pago, etc.): una función, no una
-- política de lectura sobre toda la fila.
drop policy if exists "projects_inspecciones_read" on public.projects;
create or replace function public.inspection_projects(p_id uuid default null)
returns table (id uuid, name text, client_name text, location text, status text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.client_name, p.location, p.status
  from public.projects p
  where private.has_module('inspecciones') and (p_id is null or p.id = p_id)
  order by p.status, p.name;
$$;
revoke all on function public.inspection_projects(uuid) from public, anon;
grant execute on function public.inspection_projects(uuid) to authenticated;

create table if not exists public.inspections (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  visited_on      date not null default private.panama_today(),
  notes           text,
  created_by      uuid default auth.uid(),
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists inspections_project_idx on public.inspections (project_id, visited_on desc);

create table if not exists public.inspection_items (
  id               uuid primary key default gen_random_uuid(),
  inspection_id    uuid not null references public.inspections(id) on delete cascade,
  area             text,
  comment          text not null default '',
  status           text not null default 'pendiente' check (status in ('pendiente', 'resuelto')),
  resolved_at      timestamptz,
  resolved_by_name text,
  sort_order       integer not null default 0,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now()
);
create index if not exists inspection_items_inspection_idx on public.inspection_items (inspection_id, sort_order);

create table if not exists public.inspection_photos (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.inspection_items(id) on delete cascade,
  path        text not null,
  -- antes = el detalle; despues = cómo quedó al resolverlo (opcional).
  kind        text not null default 'antes' check (kind in ('antes', 'despues')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists inspection_photos_item_idx on public.inspection_photos (item_id, sort_order);

alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;
alter table public.inspection_photos enable row level security;

drop policy if exists "inspections_all" on public.inspections;
create policy "inspections_all" on public.inspections for all to authenticated
  using (private.has_module('inspecciones')) with check (private.has_module('inspecciones'));
drop policy if exists "inspection_items_all" on public.inspection_items;
create policy "inspection_items_all" on public.inspection_items for all to authenticated
  using (private.has_module('inspecciones')) with check (private.has_module('inspecciones'));
drop policy if exists "inspection_photos_all" on public.inspection_photos;
create policy "inspection_photos_all" on public.inspection_photos for all to authenticated
  using (private.has_module('inspecciones')) with check (private.has_module('inspecciones'));

-- Fotos: bucket privado, solo quien inspecciona.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-photos', 'inspection-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "inspection_photos_read" on storage.objects;
create policy "inspection_photos_read" on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos' and private.has_module('inspecciones'));
drop policy if exists "inspection_photos_insert" on storage.objects;
create policy "inspection_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos' and private.has_module('inspecciones'));
drop policy if exists "inspection_photos_delete" on storage.objects;
create policy "inspection_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'inspection-photos' and private.has_module('inspecciones'));
