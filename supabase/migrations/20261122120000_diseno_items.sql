-- Diseño · Etapa A: los ítems de cada proyecto y sus etapas de diseño (ver el documento «Flujo de diseño, orden de
-- producción y taller» y TALLER-PLAN.md). Decisiones de Carlos (21–22 nov):
--  * Un ítem es un mueble (mueble de TV, closet, bar…) dentro de un área del proyecto (el Den). Salen de la
--    cotización aprobada cuando existe, o se agregan a mano (hoy casi ningún proyecto activo tiene su cotización
--    aprobada en la app).
--  * Etapas: por_medir → en_diseno → con_cliente → aprobado (→ en_produccion, la pone la orden de producción).
--    Se mueven con acciones que igual hay que hacer: «Medido» pide la hoja de medidas; «Enviar al cliente» pide la
--    presentación; «Pidió cambios» vuelve a en_diseno (ronda 2, 3…); «Cliente aprobó» pide la presentación aprobada.
--  * El color del ítem puede quedar «por definir»; solo será obligatorio para la autorización a pintura (más adelante).
--  * 7 días en la misma etapa = atrasado (se calcula en la app con stage_since).

-- 1. Ítems.
create table if not exists public.project_items (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  area             text not null default '',
  name             text not null check (length(btrim(name)) > 0),
  kind             text not null default '',
  sort_order       integer not null default 0,
  stage            text not null default 'por_medir'
                     check (stage in ('por_medir', 'en_diseno', 'con_cliente', 'aprobado', 'en_produccion')),
  stage_since      timestamptz not null default now(),
  -- Cuántas veces se envió la presentación al cliente (1 = primera ronda).
  round            integer not null default 0,
  -- El área todavía no está lista para medir (con la fecha de la próxima visita, si se sabe).
  area_not_ready   boolean not null default false,
  next_visit       date,
  needs_paint      boolean not null default true,
  notes            text,
  quote_section_id uuid references public.quote_sections(id) on delete set null,
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists project_items_project_idx on public.project_items (project_id, sort_order);
create index if not exists project_items_stage_idx on public.project_items (stage);
create unique index if not exists project_items_quote_section_uq on public.project_items (quote_section_id) where quote_section_id is not null;

-- 2. Archivos de cada ítem (en Google Drive, carpeta del proyecto → DISEÑO).
create table if not exists public.project_item_files (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.project_items(id) on delete cascade,
  kind           text not null check (kind in ('medidas', 'foto', 'presentacion', 'aprobada')),
  round          integer not null default 0,
  drive_file_id  text not null,
  name           text not null,
  mime_type      text,
  size_bytes     bigint,
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists project_item_files_item_idx on public.project_item_files (item_id, created_at);

-- 3. Historial.
create table if not exists public.project_item_events (
  id          bigint generated always as identity primary key,
  item_id     uuid not null references public.project_items(id) on delete cascade,
  kind        text not null check (kind in ('creado', 'etapa', 'archivo', 'editado')),
  from_stage  text,
  to_stage    text,
  detail      text,
  actor_id    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists project_item_events_item_idx on public.project_item_events (item_id, created_at);

-- 4. Permisos: Diseño (las diseñadoras) y quien administra proyectos.
alter table public.project_items enable row level security;
alter table public.project_item_files enable row level security;
alter table public.project_item_events enable row level security;

drop policy if exists "project_items_access" on public.project_items;
create policy "project_items_access" on public.project_items for all to authenticated
  using (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'))
  with check (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'));
drop policy if exists "project_item_files_access" on public.project_item_files;
create policy "project_item_files_access" on public.project_item_files for all to authenticated
  using (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'))
  with check (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'));
drop policy if exists "project_item_events_read" on public.project_item_events;
create policy "project_item_events_read" on public.project_item_events for select to authenticated
  using (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'));
grant select, insert, update, delete on public.project_items, public.project_item_files to authenticated;
grant select on public.project_item_events to authenticated;

-- 5. Historial automático: al crear, al cambiar de etapa (con la fecha) y al subir un archivo.
create or replace function private.project_item_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_since := now();
  end if;
  return new;
end; $$;
drop trigger if exists project_items_before on public.project_items;
create trigger project_items_before before insert or update on public.project_items
  for each row execute function private.project_item_before();

create or replace function private.project_item_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.project_item_events (item_id, kind, to_stage) values (new.id, 'creado', new.stage);
  elsif new.stage is distinct from old.stage then
    insert into public.project_item_events (item_id, kind, from_stage, to_stage) values (new.id, 'etapa', old.stage, new.stage);
  end if;
  return null;
end; $$;
drop trigger if exists project_items_after on public.project_items;
create trigger project_items_after after insert or update on public.project_items
  for each row execute function private.project_item_after();

create or replace function private.project_item_file_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_item_events (item_id, kind, detail) values (new.item_id, 'archivo', new.kind || ': ' || new.name);
  return null;
end; $$;
drop trigger if exists project_item_files_after on public.project_item_files;
create trigger project_item_files_after after insert on public.project_item_files
  for each row execute function private.project_item_file_after();

-- 6. Traer los ítems de las cotizaciones aprobadas del proyecto (las diseñadoras no leen las cotizaciones, que
--    tienen precios: esta función solo copia ubicación, nombre y tipo). No repite los que ya se trajeron.
create or replace function public.import_quote_items(p_project uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
  v_next integer;
begin
  if not (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas')) then
    raise exception 'Sin permiso';
  end if;
  select coalesce(max(sort_order), 0) into v_next from public.project_items where project_id = p_project;
  insert into public.project_items (project_id, area, name, kind, sort_order, quote_section_id)
  select p_project, btrim(s.location), coalesce(nullif(btrim(s.name), ''), s.kind, 'Ítem'), coalesce(s.kind, ''),
         v_next + row_number() over (order by q.created_at, s.sort_order), s.id
    from public.quote_sections s
    join public.quotes q on q.id = s.quote_id
   where q.project_id = p_project and q.status = 'APROBADA'
     and not exists (select 1 from public.project_items i where i.quote_section_id = s.id);
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
revoke all on function public.import_quote_items(uuid) from public, anon;
grant execute on function public.import_quote_items(uuid) to authenticated;

-- ¿Cuántos ítems de cotizaciones aprobadas faltan por traer? (para ofrecer el botón solo cuando sirve)
create or replace function public.quote_items_pending(p_project uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::int
    from public.quote_sections s
    join public.quotes q on q.id = s.quote_id
   where (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'))
     and q.project_id = p_project and q.status = 'APROBADA'
     and not exists (select 1 from public.project_items i where i.quote_section_id = s.id)
$$;
revoke all on function public.quote_items_pending(uuid) from public, anon;
grant execute on function public.quote_items_pending(uuid) to authenticated;
