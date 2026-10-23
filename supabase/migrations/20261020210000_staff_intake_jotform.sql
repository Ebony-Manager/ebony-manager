-- Bandeja de "Nuevos registros" de Staff, alimentada por JotForm.
--
-- Cuando alguien llena el formulario "Registro Empleado", JotForm avisa al
-- webhook de la app (/api/jotform/webhook), que guarda la respuesta acá ya
-- normalizada. En Staff alguien con el módulo la revisa: la crea como
-- empleado o contratista, la vincula a alguien que ya existe, o la descarta.
--
-- Sin service_role: el webhook no tiene sesión, así que escribe con la clave
-- pública llamando a public.ingest_staff_intake, que solo acepta si el token
-- de la URL del webhook coincide con el guardado (como hash) en
-- private.integration_tokens. La tabla no tiene policy de INSERT: es la
-- única puerta de entrada.
--
-- Sin sentencias que borren objetos. Idempotente.

create table if not exists public.staff_intake (
  id                          uuid primary key default gen_random_uuid(),
  source                      text not null default 'jotform',
  form_id                     text,
  submission_id               text not null,
  submitted_at                timestamptz,
  first_name                  text,
  last_name                   text,
  email                       text,
  phone                       text,
  birth_date                  date,
  address                     text,
  id_document_url             text,
  bank_name                   text,
  bank_account_type           text check (bank_account_type is null or bank_account_type in ('ahorro', 'corriente')),
  bank_account_number         text,
  emergency_contact_name      text,
  emergency_contact_phone     text,
  emergency_contact_relation  text,
  raw                         jsonb not null default '{}'::jsonb,
  status                      text not null default 'pending'
                                check (status in ('pending', 'created', 'linked', 'dismissed')),
  person_kind                 text check (person_kind is null or person_kind in ('employee', 'contractor')),
  person_id                   uuid,
  resolved_at                 timestamptz,
  resolved_by                 uuid references auth.users (id) on delete set null,
  created_at                  timestamptz not null default now(),
  unique (source, submission_id)
);

comment on table public.staff_intake is
  'Respuestas del formulario de registro (JotForm) por revisar en Staff. Entran solo por public.ingest_staff_intake.';
comment on column public.staff_intake.status is
  'pending = por revisar; created = se creó la ficha; linked = se completó una ficha existente; dismissed = descartado.';

create index if not exists staff_intake_pending_idx on public.staff_intake (created_at desc) where status = 'pending';

alter table public.staff_intake enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'staff_intake'
                 and policyname = 'staff_intake_select_staff_modules') then
    create policy "staff_intake_select_staff_modules" on public.staff_intake
      for select to authenticated
      using (private.has_module('planilla') or private.has_module('contratistas'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'staff_intake'
                 and policyname = 'staff_intake_update_staff_modules') then
    create policy "staff_intake_update_staff_modules" on public.staff_intake
      for update to authenticated
      using (private.has_module('planilla') or private.has_module('contratistas'))
      with check (private.has_module('planilla') or private.has_module('contratistas'));
  end if;
end;
$$;

-- ============================================================================
-- Tokens de integraciones (solo el hash; el token vive en la URL del webhook)
-- ============================================================================
create table if not exists private.integration_tokens (
  name        text primary key,
  token_hash  text not null,
  created_at  timestamptz not null default now()
);

comment on table private.integration_tokens is
  'SHA-256 (hex) del token de cada integración entrante. El token en claro no se guarda.';

-- ============================================================================
-- Entrada del webhook
-- ============================================================================
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
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation, raw
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
