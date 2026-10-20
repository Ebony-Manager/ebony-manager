-- Ficha del contratista igual a la del empleado + nacionalidad como país.
--
-- 1) contractors gana los datos personales que ya tenía payroll_employees:
--    tipo de documento, nacionalidad, fecha de nacimiento, foto, contacto de
--    emergencia, contrato y cuenta bancaria. `contact_info` (texto libre) deja
--    de usarse en la app: lo que tuviera se pasa a `notes` (el 2026-10-20 no
--    había ninguno con datos). La columna se deja, sin uso, porque esta
--    migración evita sentencias que borran objetos (ver usuarios_permisos).
-- 2) Nacionalidad = código de país ISO 3166-1 de dos letras ("PA"), elegido
--    de una lista en la app. Se convierten los textos que había en
--    payroll_employees ("Panameño", "Colombiana", "Ecuador"…).
-- 3) Bucket privado contractor-photos, para el módulo Contratistas.
--
-- Idempotente: se puede correr más de una vez.

-- ============================================================================
-- 1. contractors: datos personales
-- ============================================================================
alter table public.contractors
  add column if not exists id_document_type        text,
  add column if not exists nationality             text,
  add column if not exists birth_date              date,
  add column if not exists photo_path              text,
  add column if not exists emergency_contact_name  text,
  add column if not exists emergency_contact_phone text,
  add column if not exists contract_info           text,
  add column if not exists bank_name               text,
  add column if not exists bank_account_type       text,
  add column if not exists bank_account_number     text,
  add column if not exists bank_routing_code       text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contractors_id_document_type_check') then
    alter table public.contractors add constraint contractors_id_document_type_check
      check (id_document_type is null or id_document_type in ('cedula', 'pasaporte'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contractors_bank_account_type_check') then
    alter table public.contractors add constraint contractors_bank_account_type_check
      check (bank_account_type is null or bank_account_type in ('ahorro', 'corriente'));
  end if;
end;
$$;

comment on column public.contractors.nationality is 'Código de país ISO 3166-1 alfa-2 (ej. PA). NULL si no se sabe.';
comment on column public.contractors.photo_path is 'Ruta en el bucket privado contractor-photos. NULL = sin foto (se muestra la inicial).';
comment on column public.contractors.contact_info is 'SIN USO desde 2026-10-20: reemplazado por emergency_contact_name/phone (lo que hubiera se pasó a notes).';

update public.contractors
   set notes = concat_ws(E'\n', nullif(trim(notes), ''), 'Contacto: ' || trim(contact_info)),
       contact_info = null
 where coalesce(trim(contact_info), '') <> '';

-- ============================================================================
-- 2. Nacionalidad como código de país
-- ============================================================================
comment on column public.payroll_employees.nationality is 'Código de país ISO 3166-1 alfa-2 (ej. PA). NULL si no se sabe.';

update public.payroll_employees
   set nationality = case
     when lower(trim(nationality)) in ('panameño', 'panameña', 'panameno', 'panamena', 'panamá', 'panama') then 'PA'
     when lower(trim(nationality)) in ('colombiano', 'colombiana', 'colombia') then 'CO'
     when lower(trim(nationality)) in ('venezolano', 'venezolana', 'venezuela') then 'VE'
     when lower(trim(nationality)) in ('ecuatoriano', 'ecuatoriana', 'ecuador') then 'EC'
     when lower(trim(nationality)) in ('nicaragüense', 'nicaraguense', 'nicaragua') then 'NI'
     when lower(trim(nationality)) in ('costarricense', 'costa rica') then 'CR'
     when lower(trim(nationality)) in ('dominicano', 'dominicana', 'república dominicana', 'republica dominicana') then 'DO'
     when lower(trim(nationality)) in ('cubano', 'cubana', 'cuba') then 'CU'
     else nationality
   end
 where nationality is not null and length(trim(nationality)) <> 2;

-- ============================================================================
-- 3. Fotos de contratistas (bucket privado, módulo Contratistas)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contractor-photos', 'contractor-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'contractor_photos_module_all') then
    create policy "contractor_photos_module_all"
      on storage.objects for all
      to authenticated
      using (bucket_id = 'contractor-photos' and private.has_module('contratistas'))
      with check (bucket_id = 'contractor-photos' and private.has_module('contratistas'));
  end if;
end;
$$;
