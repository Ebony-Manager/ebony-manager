-- Módulo Proyectos: el proyecto es la "madre" de todo lo de una obra
-- (hoy sus contratos; luego cotizaciones, inspecciones, autorizaciones,
-- inventario entregado…). Se agrega el permiso `proyectos` para poder ver y
-- editar proyectos sin ver pagos; quien tiene Contratistas sigue viéndolos.
-- Los contratos (montos) siguen pidiendo Contratistas.

alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'planilla', 'asistencia', 'contratistas', 'proyectos']::text[]);

drop policy if exists "projects_module_all" on public.projects;
create policy "projects_module_all" on public.projects
  for all to authenticated
  using (private.has_module('proyectos') or private.has_module('contratistas'))
  with check (private.has_module('proyectos') or private.has_module('contratistas'));
