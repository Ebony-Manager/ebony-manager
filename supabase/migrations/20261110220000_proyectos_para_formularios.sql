-- Los accesos rápidos de autorizaciones (pintura / embalaje) piden escoger el
-- proyecto antes de abrir el formulario. Quien solo tiene ese acceso no ve la
-- tabla de proyectos: esta función le da solo el id y el nombre de los activos.
create or replace function public.active_projects_for_forms()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name
    from public.projects p
   where p.status = 'ACTIVE'
     and (private.has_module('form_autorizaciones') or private.has_module('proyectos') or private.has_module('contratistas'))
   order by p.name;
$$;
revoke all on function public.active_projects_for_forms() from public, anon;
grant execute on function public.active_projects_for_forms() to authenticated;
