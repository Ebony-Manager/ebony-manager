-- Foto (o PDF) de la cédula / pasaporte en la ficha de empleados y contratistas.
--
-- Se guarda en el bucket PRIVADO staff-documents:
--   employees/<id>/...    → lo ve quien tiene Planilla
--   contractors/<id>/...  → lo ve quien tiene Contratistas
-- y la ruta en id_document_path de cada ficha. Se sube desde la ficha, o
-- se copia de JotForm al crear o vincular a alguien desde "Nuevos registros".
--
-- Sin sentencias que borren objetos. Idempotente.

alter table public.payroll_employees add column if not exists id_document_path text;
alter table public.contractors       add column if not exists id_document_path text;

comment on column public.payroll_employees.id_document_path is
  'Ruta en el bucket privado staff-documents (employees/<id>/...) de la foto o PDF del documento. NULL = sin documento.';
comment on column public.contractors.id_document_path is
  'Ruta en el bucket privado staff-documents (contractors/<id>/...) de la foto o PDF del documento. NULL = sin documento.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-documents', 'staff-documents', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'staff_documents_employees_planilla') then
    create policy "staff_documents_employees_planilla"
      on storage.objects for all
      to authenticated
      using (bucket_id = 'staff-documents' and (storage.foldername(name))[1] = 'employees' and private.has_module('planilla'))
      with check (bucket_id = 'staff-documents' and (storage.foldername(name))[1] = 'employees' and private.has_module('planilla'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'staff_documents_contractors_contratistas') then
    create policy "staff_documents_contractors_contratistas"
      on storage.objects for all
      to authenticated
      using (bucket_id = 'staff-documents' and (storage.foldername(name))[1] = 'contractors' and private.has_module('contratistas'))
      with check (bucket_id = 'staff-documents' and (storage.foldername(name))[1] = 'contractors' and private.has_module('contratistas'));
  end if;
end;
$$;
