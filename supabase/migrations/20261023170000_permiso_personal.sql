-- Permisos de Personal, por niveles:
--   Personal (clave `documentos`)  — ver la lista del personal, su contacto y
--   │                                 sus documentos, y descargarlos. Solo lectura.
--   ├─ Planilla                     — el dinero de los empleados
--   │   └─ Asistencia
--   └─ Contratistas                 — el dinero de los contratistas
--
-- La clave se queda `documentos` (ya está en el check de allowed_emails y
-- en las reglas de Storage); en pantalla se llama "Personal".
--
-- `staff_people()` reemplaza a `staff_directory()` con la fecha de inicio y
-- el orden (para el color del avatar), que necesita la lista de Staff.

create or replace function public.staff_people()
returns table (
  kind text,
  id uuid,
  name text,
  group_key text,
  "position" text,
  active boolean,
  start_date date,
  sort_order integer,
  id_document text,
  id_document_type text,
  id_document_path text,
  nationality text,
  birth_date date,
  phone text,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  photo_path text
)
language sql stable security definer set search_path = ''
as $$
  select 'employee', e.id, e.name, e.categoria, e.position, e.status = 'ACTIVE', e.start_date, e.sort_order,
         e.id_document, e.id_document_type, e.id_document_path, e.nationality, e.birth_date,
         e.phone, e.email, e.address, e.emergency_contact_name, e.emergency_contact_phone, e.photo_path
  from public.payroll_employees e
  where private.has_module('documentos') or private.has_module('planilla')
  union all
  select 'contractor', c.id, c.name, c.contractor_type, null, c.status = 'ACTIVE', c.start_date, c.sort_order,
         c.id_document, c.id_document_type, c.id_document_path, c.nationality, c.birth_date,
         c.phone, c.email, c.address, c.emergency_contact_name, c.emergency_contact_phone, c.photo_path
  from public.contractors c
  where private.has_module('documentos') or private.has_module('contratistas')
$$;

revoke all on function public.staff_people() from public, anon;
grant execute on function public.staff_people() to authenticated;

-- Quien ya tenía Planilla o Contratistas recibe el permiso padre. (Cambiar
-- permisos lo exige hacer como admin — protect_profile_privileged_columns —
-- así que se corrió con la sesión de un admin.)
update public.allowed_emails
set modules = array_append(modules, 'documentos')
where (modules && array['planilla', 'contratistas']) and not ('documentos' = any (modules));

-- staff_directory() queda sin uso (se borra aparte):
-- drop function if exists public.staff_directory();
