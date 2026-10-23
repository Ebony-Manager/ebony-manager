-- Permiso "Documentos del personal" (`documentos`): ver y descargar los
-- documentos y datos de contacto de empleados y contratistas — p. ej. para
-- mandar cédulas a un edificio — SIN ver dinero (sueldos, saldos,
-- préstamos, contratos ni cuentas de banco). Solo lectura.
--
-- El sueldo y la cuenta de banco viven en la misma fila que la cédula, así
-- que este permiso NO abre las tablas: lee por `staff_directory()`, que
-- devuelve solo columnas seguras. Quien tiene Planilla ve ahí a los
-- empleados y quien tiene Contratistas a los contratistas, igual que hoy.
-- Las fotos y documentos se abren con permiso de solo lectura en Storage.

alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'proyectos', 'planilla', 'asistencia', 'contratistas', 'documentos']::text[]);

create or replace function public.staff_directory()
returns table (
  kind text,
  id uuid,
  name text,
  group_key text,
  "position" text,
  active boolean,
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
  select 'employee', e.id, e.name, e.categoria, e.position, e.status = 'ACTIVE',
         e.id_document, e.id_document_type, e.id_document_path, e.nationality, e.birth_date,
         e.phone, e.email, e.address, e.emergency_contact_name, e.emergency_contact_phone, e.photo_path
  from public.payroll_employees e
  where private.has_module('documentos') or private.has_module('planilla')
  union all
  select 'contractor', c.id, c.name, c.contractor_type, null, c.status = 'ACTIVE',
         c.id_document, c.id_document_type, c.id_document_path, c.nationality, c.birth_date,
         c.phone, c.email, c.address, c.emergency_contact_name, c.emergency_contact_phone, c.photo_path
  from public.contractors c
  where private.has_module('documentos') or private.has_module('contratistas')
$$;

revoke all on function public.staff_directory() from public, anon;
grant execute on function public.staff_directory() to authenticated;

-- Solo lectura de fotos y documentos para `documentos`.
create policy "staff_documents_documentos_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'staff-documents' and private.has_module('documentos'));
create policy "employee_photos_documentos_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'employee-photos' and private.has_module('documentos'));
create policy "contractor_photos_documentos_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'contractor-photos' and private.has_module('documentos'));
