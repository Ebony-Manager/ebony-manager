-- Asistencia: las ponchadas se guardan (antes se leían del archivo cada vez).
--
-- Dos fuentes:
--  - reloj:   el reporte CSV del aparato del taller, que se sube desde
--             Pagos → Asistencia (puede subirse varias veces: no duplica).
--  - jotform: el formulario "Punch In/Out" de la gente en proyectos. Llega
--             solo, por el mismo webhook de JotForm de la app, a través de
--             public.ingest_attendance_punch (token, sin service_role). El
--             export xlsx del formulario también se puede subir para el
--             histórico; no duplica lo que ya llegó por el webhook.
--
-- `dedupe_key` = fuente | código (o nombre) | fecha | minuto: la misma
-- marcación subida dos veces (o por archivo y por webhook) entra una vez.
--
-- El empleado se resuelve al leer (por nombre, con los alias de
-- attendance_name_links), así un nombre mal escrito se corrige una vez y
-- vale para todas sus ponchadas, pasadas y futuras.
--
-- Sin sentencias que borren objetos. Idempotente.

create table if not exists public.attendance_punches (
  id             uuid primary key default gen_random_uuid(),
  source         text not null check (source in ('reloj', 'jotform')),
  dedupe_key     text not null unique,
  raw_name       text not null,
  code           text,
  punch_date     date not null,
  punch_minutes  integer not null check (punch_minutes between 0 and 1439),
  kind           text not null default 'unknown' check (kind in ('in', 'out', 'unknown')),
  location       text,
  submission_id  text,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id) on delete set null
);

comment on table public.attendance_punches is
  'Ponchadas del reloj del taller (archivo) y del Jotform Punch In/Out (webhook o archivo). Una fila por marcación.';

create index if not exists attendance_punches_date_idx on public.attendance_punches (punch_date);

alter table public.attendance_punches enable row level security;

-- Nombre del archivo/formulario → empleado. employee_id null = "no es
-- empleado" (ej. un contratista que poncha): deja de salir como sin vincular.
create table if not exists public.attendance_name_links (
  name_key     text primary key,
  employee_id  uuid references public.payroll_employees (id) on delete cascade,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null
);

comment on table public.attendance_name_links is
  'Vínculos manuales de un nombre de las ponchadas (minúsculas, sin acentos) a un empleado; employee_id null = ignorar.';

alter table public.attendance_name_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_punches'
                 and policyname = 'attendance_punches_select') then
    create policy "attendance_punches_select" on public.attendance_punches
      for select to authenticated using (private.has_module('asistencia'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_punches'
                 and policyname = 'attendance_punches_insert') then
    create policy "attendance_punches_insert" on public.attendance_punches
      for insert to authenticated with check (private.has_module('asistencia'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_punches'
                 and policyname = 'attendance_punches_delete') then
    create policy "attendance_punches_delete" on public.attendance_punches
      for delete to authenticated using (private.has_module('asistencia'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_name_links'
                 and policyname = 'attendance_name_links_select') then
    create policy "attendance_name_links_select" on public.attendance_name_links
      for select to authenticated using (private.has_module('asistencia'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_name_links'
                 and policyname = 'attendance_name_links_insert') then
    create policy "attendance_name_links_insert" on public.attendance_name_links
      for insert to authenticated with check (private.has_module('asistencia'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_name_links'
                 and policyname = 'attendance_name_links_update') then
    create policy "attendance_name_links_update" on public.attendance_name_links
      for update to authenticated using (private.has_module('asistencia')) with check (private.has_module('asistencia'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_name_links'
                 and policyname = 'attendance_name_links_delete') then
    create policy "attendance_name_links_delete" on public.attendance_name_links
      for delete to authenticated using (private.has_module('asistencia'));
  end if;
end;
$$;

-- ============================================================================
-- Entrada del webhook (formulario Punch In/Out)
-- ============================================================================
create or replace function public.ingest_attendance_punch(p_token text, p_data jsonb)
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

  if coalesce(p_data ->> 'dedupe_key', '') = '' or coalesce(p_data ->> 'raw_name', '') = '' then
    raise exception 'Faltan datos de la ponchada';
  end if;

  insert into public.attendance_punches (
    source, dedupe_key, raw_name, code, punch_date, punch_minutes, kind, location, submission_id
  ) values (
    'jotform',
    p_data ->> 'dedupe_key',
    p_data ->> 'raw_name',
    nullif(p_data ->> 'code', ''),
    (p_data ->> 'punch_date')::date,
    (p_data ->> 'punch_minutes')::integer,
    coalesce(nullif(p_data ->> 'kind', ''), 'unknown'),
    nullif(p_data ->> 'location', ''),
    nullif(p_data ->> 'submission_id', '')
  )
  -- JotForm puede avisar dos veces, o la ponchada ya entró por el export.
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ingest_attendance_punch(text, jsonb) from public;
grant execute on function public.ingest_attendance_punch(text, jsonb) to anon, authenticated;
