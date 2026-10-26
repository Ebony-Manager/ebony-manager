-- Registro de empleados (JotForm): el formulario ahora pide el número de
-- cédula o pasaporte y el país (nacionalidad). La bandeja los guarda y, al
-- crear o completar la ficha, pasan a id_document / id_document_type /
-- nationality (solo si la ficha los tenía vacíos).
--
-- Sin sentencias que borren objetos. Idempotente.

alter table public.staff_intake
  add column if not exists id_number        text,
  add column if not exists id_document_type text check (id_document_type is null or id_document_type in ('cedula', 'pasaporte')),
  add column if not exists nationality      text;

comment on column public.staff_intake.nationality is 'Código de país ISO 3166-1 alfa-2 (ej. PA), del campo "Country" del formulario.';

create or replace function public.ingest_staff_intake(p_token text, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'jotform'
       and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(p_data ->> 'submission_id', '') = '' then
    raise exception 'Falta submission_id';
  end if;

  insert into public.staff_intake (
    source, form_id, submission_id, submitted_at, first_name, last_name, email, phone, birth_date,
    address, id_document_url, bank_name, bank_account_type, bank_account_number,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    id_number, id_document_type, nationality, raw
  ) values (
    'jotform',
    p_data ->> 'form_id',
    p_data ->> 'submission_id',
    nullif(p_data ->> 'submitted_at', '')::timestamptz,
    p_data ->> 'first_name',
    p_data ->> 'last_name',
    p_data ->> 'email',
    p_data ->> 'phone',
    nullif(p_data ->> 'birth_date', '')::date,
    p_data ->> 'address',
    p_data ->> 'id_document_url',
    p_data ->> 'bank_name',
    p_data ->> 'bank_account_type',
    p_data ->> 'bank_account_number',
    p_data ->> 'emergency_contact_name',
    p_data ->> 'emergency_contact_phone',
    p_data ->> 'emergency_contact_relation',
    p_data ->> 'id_number',
    p_data ->> 'id_document_type',
    p_data ->> 'nationality',
    coalesce(p_data -> 'raw', '{}'::jsonb)
  )
  -- JotForm puede avisar dos veces la misma respuesta: la segunda no duplica.
  on conflict (source, submission_id) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ingest_staff_intake(text, jsonb) from public;
grant execute on function public.ingest_staff_intake(text, jsonb) to anon, authenticated;
