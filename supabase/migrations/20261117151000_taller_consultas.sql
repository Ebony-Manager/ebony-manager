-- Taller: lo que ven quienes tienen el permiso Taller sin abrir Personal (que trae sueldos) ni Proyectos.

-- Personas activas de Personal (nombre, cargo, foto) y su usuario de la app si tiene.
create or replace function public.taller_people()
returns table (employee_id uuid, name text, "position" text, photo_path text, user_id uuid)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.name, e.position, e.photo_path, private.user_of_employee(e.id)
    from public.payroll_employees e
   where e.status = 'ACTIVE' and private.has_module('taller')
   order by e.name
$$;
revoke all on function public.taller_people() from public, anon;
grant execute on function public.taller_people() to authenticated;

-- Proyectos (nombre y estado) para elegir a cuál pertenece un trabajo.
create or replace function public.taller_projects()
returns table (id uuid, name text, status text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.status from public.projects p
   where private.has_module('taller')
   order by (p.status = 'ACTIVE') desc, p.name
$$;
revoke all on function public.taller_projects() from public, anon;
grant execute on function public.taller_projects() to authenticated;

-- La carpeta de Drive del proyecto (para guardar ahí los archivos del trabajo, en la subcarpeta CNC).
create or replace function public.taller_project_folder(p_project uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select p.drive_folder_id from public.projects p where p.id = p_project and private.has_module('taller')
$$;
revoke all on function public.taller_project_folder(uuid) from public, anon;
grant execute on function public.taller_project_folder(uuid) to authenticated;
