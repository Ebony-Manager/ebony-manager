-- Fase 2 — Planilla: ficha completa del empleado + foto.
--
-- 1) Cuatro columnas NUEVAS en payroll_employees (todas NULLABLE, sin
--    default: no reescribe filas existentes):
--      id_document_type  'cedula' | 'pasaporte' (el número sigue en id_document)
--      nationality       texto libre
--      birth_date        fecha de nacimiento
--      photo_path        ruta de la foto dentro del bucket 'employee-photos'
-- 2) Bucket PRIVADO 'employee-photos' (2 MB, jpeg/png/webp) y una policy
--    solo-admin sobre storage.objects, mismo criterio que el resto de
--    Planilla (private.is_admin()). La app muestra la foto con una URL
--    firmada de corta duración; nunca es pública.
--
-- Aplicar pegando este archivo en el SQL Editor del proyecto Ebony
-- (jdfkfbopecqvvyxherku). La RLS y el trigger de updated_at de la tabla
-- ya existen desde 20260906180000_fase2_planilla.sql y no se tocan.

alter table public.payroll_employees
  add column id_document_type text check (id_document_type is null or id_document_type in ('cedula', 'pasaporte')),
  add column nationality      text,
  add column birth_date       date,
  add column photo_path       text;

comment on column public.payroll_employees.id_document_type is '''cedula'' o ''pasaporte''. NULL si aún no se registra.';
comment on column public.payroll_employees.nationality is 'Nacionalidad (texto libre). NULL si aún no se registra.';
comment on column public.payroll_employees.birth_date is 'Fecha de nacimiento. NULL si aún no se registra.';
comment on column public.payroll_employees.photo_path is 'Ruta del archivo en el bucket privado employee-photos. NULL = sin foto (se muestra la inicial).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-photos', 'employee-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "employee_photos_admin_all"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'employee-photos' and private.is_admin())
  with check (bucket_id = 'employee-photos' and private.is_admin());
