-- Inspecciones: cada detalle dice de qué es (pintura, carpintería u otro), qué
-- pintor lo arregla (el que pintó ese mueble) y quién es responsable del daño
-- (Ebony o un tercero, con una línea de quién). Los detalles que ya existían
-- quedan sin tipo ("Sin clasificar") hasta que alguien los edite.
--
-- Los pintores son contratistas de tipo "pintor"; quien inspecciona no puede
-- leer la tabla de contratistas (tiene cuentas de banco), así que los ve con
-- una función que solo devuelve id y nombre.

alter table public.inspection_items
  add column if not exists kind text check (kind in ('pintura', 'carpinteria', 'otro')),
  add column if not exists painter_id uuid references public.contractors(id) on delete set null,
  add column if not exists responsible text not null default 'ebony' check (responsible in ('ebony', 'tercero')),
  add column if not exists third_party text;

create index if not exists inspection_items_painter_idx on public.inspection_items (painter_id) where painter_id is not null;

-- Pintores para elegir (activos) y para mostrar el nombre (también los inactivos).
create or replace function public.inspection_painters()
returns table (id uuid, name text, active boolean)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.status = 'ACTIVE'
  from public.contractors c
  where private.has_module('inspecciones') and c.contractor_type = 'pintor'
  order by c.name;
$$;
revoke all on function public.inspection_painters() from public, anon;
grant execute on function public.inspection_painters() to authenticated;
