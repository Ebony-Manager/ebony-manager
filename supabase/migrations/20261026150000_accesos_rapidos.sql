-- Permisos de "Accesos rápidos" (botones a formularios de JotForm en el menú):
--   accesos              → padre (el grupo)
--   form_autorizaciones  → Autorización a Pintura y a Embalaje
--   form_registro        → compartir el enlace del formulario «Registro Empleado»
-- Son solo enlaces: no dan acceso a datos (no hay RLS que tocar).
-- Los permisos de cada persona los asigna un admin en Settings → Usuarios
-- (la base no deja cambiarlos desde afuera de la app).

alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'proyectos', 'planilla', 'asistencia', 'contratistas', 'documentos',
                          'almacen', 'almacen_compras', 'almacen_costos', 'almacen_ajustes', 'directorio',
                          'accesos', 'form_autorizaciones', 'form_registro']::text[]);

