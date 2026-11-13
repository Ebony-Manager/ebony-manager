-- Diseñadoras (equipo de Ebony) en los proyectos.
--
--  * Permiso nuevo `diseno`: ve TODOS los proyectos, hace sus formularios y ve las cotizaciones APROBADAS de
--    cada proyecto SIN precios (un proyecto lo es desde que se aprueba la cotización). No es "Cotización":
--    ese permiso sigue dando todo.
--  * `project_designers`: qué personas de Personal (payroll_employees) llevan cada proyecto (varias por
--    proyecto). Sirve para filtrar "mis proyectos" y, más adelante, para dueñas de ítems de producción.
--    Se asigna a la persona, no al usuario: se puede asignar antes de darle acceso a la app.
--  * Los precios no se esconden en la pantalla sino aquí: las diseñadoras NO tienen lectura sobre quotes,
--    quote_sections ni quote_lines. Solo leen dos funciones que devuelven la cotización sin ningún monto
--    (ni precios, ni márgenes, ni costos, ni totales, ni ITBMS, ni descuentos).

-- 1. El permiso.
alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'proyectos', 'planilla', 'asistencia', 'contratistas', 'documentos',
                          'almacen', 'almacen_compras', 'almacen_costos', 'almacen_ajustes', 'almacen_herramientas', 'directorio',
                          'accesos', 'form_autorizaciones', 'form_registro', 'inspecciones', 'diseno']::text[]);

-- 2. Quiénes son las diseñadoras de cada proyecto.
create table if not exists public.project_designers (
  project_id  uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.payroll_employees(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (project_id, employee_id)
);
create index if not exists project_designers_employee_idx on public.project_designers (employee_id);
alter table public.project_designers enable row level security;

-- 3. Ayudas: la persona de Personal de quien tiene sesión, y si es diseñadora de un proyecto.
create or replace function private.my_employee_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select a.employee_id
    from public.allowed_emails a
    join public.profiles p on lower(p.email) = lower(a.email)
   where p.id = auth.uid()
   limit 1
$$;
revoke all on function private.my_employee_id() from public, anon;
grant execute on function private.my_employee_id() to authenticated;

-- Con el permiso Diseño se ven todos los proyectos (el parámetro queda por compatibilidad con las políticas).
create or replace function private.is_designer_of(p_project uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_module('diseno')
$$;
revoke all on function private.is_designer_of(uuid) from public, anon;
grant execute on function private.is_designer_of(uuid) to authenticated;

-- ¿Puede esta diseñadora ver la cotización (aprobada, de un proyecto) cuyo id viene como carpeta de una imagen? (las imágenes se guardan en "<id de la cotización>/archivo.jpg")
create or replace function private.designer_can_see_quote_folder(p_folder text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.quotes q
                  where q.id::text = p_folder and q.status = 'APROBADA' and q.project_id is not null and private.is_designer_of(q.project_id))
$$;
revoke all on function private.designer_can_see_quote_folder(text) from public, anon;
grant execute on function private.designer_can_see_quote_folder(text) to authenticated;

-- 4. Políticas.
drop policy if exists "project_designers_manage" on public.project_designers;
create policy "project_designers_manage" on public.project_designers for all to authenticated
  using (private.has_module('proyectos') or private.has_module('contratistas'))
  with check (private.has_module('proyectos') or private.has_module('contratistas'));

drop policy if exists "project_designers_own_read" on public.project_designers;
create policy "project_designers_own_read" on public.project_designers for select to authenticated
  using (employee_id = private.my_employee_id());

drop policy if exists "projects_designer_read" on public.projects;
create policy "projects_designer_read" on public.projects for select to authenticated
  using (private.is_designer_of(id));

drop policy if exists "project_deliveries_designer_read" on public.project_deliveries;
create policy "project_deliveries_designer_read" on public.project_deliveries for select to authenticated
  using (project_id is not null and private.is_designer_of(project_id));

drop policy if exists "quote_images_designer_read" on storage.objects;
create policy "quote_images_designer_read" on storage.objects for select to authenticated
  using (bucket_id = 'quote-images' and private.designer_can_see_quote_folder((storage.foldername(name))[1]));

-- 5. Para armar la pantalla del proyecto (sin abrir Personal, que trae sueldos).
create or replace function public.project_designers_list(p_project uuid)
returns table (employee_id uuid, name text, "position" text, active boolean, has_access boolean)
language sql stable security definer set search_path = ''
as $$
  select d.employee_id, e.name, e.position, e.status = 'ACTIVE',
         exists (select 1 from public.allowed_emails a where a.employee_id = e.id)
    from public.project_designers d
    join public.payroll_employees e on e.id = d.employee_id
   where d.project_id = p_project
     and (private.has_module('proyectos') or private.has_module('contratistas') or private.is_designer_of(p_project))
   order by e.name
$$;
revoke all on function public.project_designers_list(uuid) from public, anon;
grant execute on function public.project_designers_list(uuid) to authenticated;

-- A quién se puede asignar: gente activa de Personal (solo nombre y cargo); las diseñadoras primero.
create or replace function public.designer_candidates()
returns table (id uuid, name text, "position" text, has_access boolean)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.name, e.position, exists (select 1 from public.allowed_emails a where a.employee_id = e.id)
    from public.payroll_employees e
   where e.status = 'ACTIVE'
     and (private.has_module('proyectos') or private.has_module('contratistas'))
   order by (e.position ilike '%diseñ%') desc, e.name
$$;
revoke all on function public.designer_candidates() from public, anon;
grant execute on function public.designer_candidates() to authenticated;

-- 6. Las cotizaciones del proyecto, sin dinero.
create or replace function public.designer_project_quotes(p_project uuid)
returns table (id uuid, number text, status text, quote_date date, client_name text, designer_name text, project_name text, items integer)
language sql stable security definer set search_path = ''
as $$
  select q.id, q.number, q.status, q.quote_date, q.client_name, q.designer_name, q.project_name,
         (select count(*)::int from public.quote_sections s where s.quote_id = q.id)
    from public.quotes q
   where q.project_id = p_project and q.status = 'APROBADA' and private.is_designer_of(p_project)
   order by q.created_at desc
$$;
revoke all on function public.designer_project_quotes(uuid) from public, anon;
grant execute on function public.designer_project_quotes(uuid) to authenticated;

-- Una cotización aprobada completa SIN ningún monto. Devuelve null si no existe, no está aprobada o no es de un proyecto.
create or replace function public.designer_quote(p_quote uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
           'id', q.id, 'number', q.number, 'status', q.status, 'quote_date', q.quote_date,
           'delivery_days', q.delivery_days, 'lang', q.lang,
           'client_name', q.client_name, 'designer_name', q.designer_name,
           'project_name', q.project_name, 'project_id', q.project_id,
           'sections', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', s.id, 'sort_order', s.sort_order, 'location', s.location, 'name', s.name,
                      'kind', s.kind, 'description', s.description, 'qty', s.qty,
                      'lines', coalesce((
                        select jsonb_agg(jsonb_build_object(
                                 'id', l.id, 'name', l.name, 'category', l.category, 'finish', l.finish, 'unit', l.unit,
                                 'shape', l.shape, 'mode', l.mode, 'width', l.width, 'height', l.height,
                                 'pieces', l.pieces, 'qty', l.qty, 'wall', l.wall) order by l.sort_order, l.id)
                          from public.quote_lines l where l.section_id = s.id), '[]'::jsonb),
                      'images', coalesce((
                        select jsonb_agg(i.path order by i.sort_order, i.id)
                          from public.quote_section_images i where i.section_id = s.id), '[]'::jsonb)
                    ) order by s.sort_order, s.id)
               from public.quote_sections s where s.quote_id = q.id), '[]'::jsonb))
    into v
    from public.quotes q
   where q.id = p_quote and q.status = 'APROBADA' and q.project_id is not null and private.is_designer_of(q.project_id);
  return v;
end;
$$;
revoke all on function public.designer_quote(uuid) from public, anon;
grant execute on function public.designer_quote(uuid) to authenticated;
