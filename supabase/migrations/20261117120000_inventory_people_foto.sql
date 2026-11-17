-- Almacén → Herramientas: mostrar la foto de quien tiene cada herramienta.
-- inventory_people() devuelve además la ruta de la foto (empleado o
-- contratista), en la misma consulta: nada de una consulta por persona.
-- Cambia el tipo que devuelve, así que hay que borrarla y crearla de nuevo.

drop function if exists public.inventory_people();

create function public.inventory_people()
returns table (kind text, id uuid, name text, active boolean, contractor_type text, photo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'empleado', e.id, e.name, e.status = 'ACTIVE', null::text, e.photo_path from public.payroll_employees e where private.has_module('almacen')
  union all
  select 'contratista', c.id, c.name, c.status = 'ACTIVE', c.contractor_type, c.photo_path from public.contractors c where private.has_module('almacen')
$$;

revoke all on function public.inventory_people() from public, anon;
grant execute on function public.inventory_people() to authenticated;
