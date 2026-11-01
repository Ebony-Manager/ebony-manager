-- Áreas de inspección: una lista fija por obra (se elige de ahí; si no existe,
-- se crea) y la pieza aparte (Mueble TV, Puerta oculta…). El detalle guarda
-- el nombre del área (texto), así que renombrar o juntar áreas actualiza sus
-- detalles en el mismo paso.

alter table public.inspection_items add column if not exists piece text;

create table if not exists public.inspection_areas (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name       text not null check (btrim(name) <> ''),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
-- Un nombre por obra (sin distinguir mayúsculas ni espacios de más).
create unique index if not exists inspection_areas_name_uq on public.inspection_areas (project_id, lower(btrim(name)));

alter table public.inspection_areas enable row level security;
drop policy if exists "inspection_areas_all" on public.inspection_areas;
create policy "inspection_areas_all" on public.inspection_areas for all to authenticated
  using (private.has_module('inspecciones')) with check (private.has_module('inspecciones'));
grant select, insert, update, delete on public.inspection_areas to authenticated;

-- Renombrar un área: también sus detalles (de esa obra).
create or replace function public.rename_inspection_area(p_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.inspection_areas%rowtype;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if not private.has_module('inspecciones') then raise exception 'SIN_PERMISO'; end if;
  if v_name = '' then raise exception 'NOMBRE_VACIO'; end if;
  select * into v from public.inspection_areas where id = p_id;
  if not found then raise exception 'AREA_NO_EXISTE'; end if;
  if exists (select 1 from public.inspection_areas where project_id = v.project_id and id <> p_id and lower(name) = lower(v_name)) then
    raise exception 'AREA_YA_EXISTE';
  end if;
  update public.inspection_items ii set area = v_name
    from public.inspections i
   where i.id = ii.inspection_id and i.project_id = v.project_id and lower(btrim(ii.area)) = lower(btrim(v.name));
  update public.inspection_areas set name = v_name where id = p_id;
end;
$$;
revoke all on function public.rename_inspection_area(uuid, text) from public, anon;
grant execute on function public.rename_inspection_area(uuid, text) to authenticated;

-- Juntar dos áreas: los detalles de p_from pasan a p_into y p_from se borra.
create or replace function public.merge_inspection_areas(p_from uuid, p_into uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  a public.inspection_areas%rowtype;
  b public.inspection_areas%rowtype;
  v_count integer;
begin
  if not private.has_module('inspecciones') then raise exception 'SIN_PERMISO'; end if;
  select * into a from public.inspection_areas where id = p_from;
  select * into b from public.inspection_areas where id = p_into;
  if a.id is null or b.id is null or a.project_id <> b.project_id or a.id = b.id then raise exception 'AREAS_INVALIDAS'; end if;
  update public.inspection_items ii set area = b.name
    from public.inspections i
   where i.id = ii.inspection_id and i.project_id = a.project_id and lower(btrim(ii.area)) = lower(btrim(a.name));
  get diagnostics v_count = row_count;
  delete from public.inspection_areas where id = p_from;
  return v_count;
end;
$$;
revoke all on function public.merge_inspection_areas(uuid, uuid) from public, anon;
grant execute on function public.merge_inspection_areas(uuid, uuid) to authenticated;

-- Limpieza aprobada por Ebony (1 nov 2026): área + pieza por obra.
with m(obra, viejo, area, piece) as (values
  ('Nómada Studio – PH Golden Palace 16', 'Rec. principal', 'Recámara principal', null),
  ('Nómada Studio – PH Golden Palace 16', 'Recamara principal', 'Recámara principal', null),
  ('Nómada Studio – PH Golden Palace 16', 'Habitación principal', 'Recámara principal', 'Curva'),
  ('Nómada Studio – PH Golden Palace 16', 'Den / mueble tv', 'Den', 'Mueble TV'),
  ('Nómada Studio – PH Golden Palace 16', 'Den / Puerta oculta', 'Den', 'Puerta oculta'),
  ('Nómada Studio – PH Golden Palace 16', 'Oficina claudia', 'Oficina Claudia', null),
  ('Nómada Studio – PH Golden Palace 16', 'Oficina Claudia mueble', 'Oficina Claudia', 'Mueble'),
  ('Nómada Studio – PH Golden Palace 16', 'Mueble - bar', 'Bar', 'Mueble'),
  ('Nómada Studio – PH Golden Palace 16', 'Mueble tv / Area social', 'Sala', 'Mueble TV'),
  ('Nómada Studio – PH Golden Palace 16', 'Columna / area social', 'Sala', 'Columna'),
  ('Nómada Studio – PH Golden Palace 16', 'Lobby / Panelado de ascensores', 'Lobby', 'Panelado de ascensores'),
  ('Nómada Studio – PH Golden Palace 16', 'Lobby / Puerta de servicio', 'Lobby', 'Puerta de servicio'),
  ('Ponticelli Estudio – PH Buenavista 4B', 'Recamara principal', 'Recámara principal', null),
  ('Ponticelli Estudio – PH Buenavista 4B', 'Den recamara  principal', 'Den recámara principal', null),
  ('Ponticelli Estudio – PH Buenavista 4B', 'Recamara secundaria 1', 'Recámara secundaria 1', null),
  ('Ponticelli Estudio – PH Buenavista 4B', 'Baño Recamara principal', 'Baño recámara principal', null),
  ('Ponticelli Estudio – PH Buenavista 4B', 'Baño recámara 2', 'Baño recámara secundaria 2', null),
  ('Ponticelli Estudio – PH Buenavista 4B', 'Baño Recamara secundaria 2', 'Baño recámara secundaria 2', null),
  ('Ponticelli Estudio – PH Buenavista 4B', 'Den', 'Den', 'Mueble'),
  ('Ponticelli Estudio – PH Buenavista 4B', 'Den familiar', 'Den', 'Mueble TV'),
  ('Ponticelli Estudio – PH Buenavista 4B', 'Puertas en general', 'General', 'Puertas'),
  ('Nora', 'Den principal panelado con dos puertas ocultas', 'Den principal', 'Panelado con puertas ocultas'),
  ('Nora', 'Den principal puerta cocina', 'Den principal', 'Puerta hacia cocina'),
  ('Nora', 'Recámara principal panelado con dos puertas ocultas', 'Recámara principal', 'Panelado con puertas ocultas'),
  ('Nora', 'Bufetera', 'Comedor', 'Bufetera')
)
update public.inspection_items ii
   set area = m.area, piece = coalesce(m.piece, ii.piece)
  from m, public.inspections i, public.projects p
 where i.id = ii.inspection_id and p.id = i.project_id and p.name = m.obra and ii.area = m.viejo;

-- Las áreas de cada obra salen de lo que ya está anotado.
insert into public.inspection_areas (project_id, name)
select distinct on (i.project_id, lower(btrim(ii.area))) i.project_id, btrim(ii.area)
  from public.inspection_items ii join public.inspections i on i.id = ii.inspection_id
 where ii.area is not null and btrim(ii.area) <> ''
 order by i.project_id, lower(btrim(ii.area)), ii.created_at
on conflict do nothing;
