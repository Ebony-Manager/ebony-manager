-- ============================================================================
-- Ebony Manager — cambios pendientes de la base de datos (corren una sola vez)
--
-- Cómo: Supabase → SQL Editor → pegar TODO este archivo → Run.
-- Es seguro correrlo más de una vez (no rompe nada si ya se aplicó).
-- Qué agrega:
--   Usuarios y permisos por módulo (Administración → Usuarios): a qué módulos
--   entra cada usuario (Cotizador, Costos, Planilla, Asistencia,
--   Contratistas) y quién ya aceptó su invitación.
--   Copia exacta de supabase/migrations/20261020120000_usuarios_permisos.sql.
--
-- (Lo que había antes en este archivo — "lleva prestaciones" y "las paga otra
-- empresa" — ya está aplicado en la base.)
-- ============================================================================

-- Usuarios y permisos por módulo.
--
-- Modelo
--   * public.allowed_emails sigue siendo la lista de quién puede entrar, y
--     ahora también dice A QUÉ entra: `role` ('admin' = todo, 'vendedor' =
--     usuario con permisos por módulo) + `modules` (cotizacion, costos,
--     planilla, asistencia, contratistas). Es lo que edita la pantalla
--     Administración → Usuarios.
--   * public.profiles lleva una copia de role + modules (la que leen la RLS y
--     el servidor). Un trigger la mantiene igual a allowed_emails: al
--     agregar/editar un correo se actualiza (o se crea, si esa persona ya
--     tenía cuenta), y al quitarlo se BORRA el perfil — sin perfil no hay
--     acceso, aunque la cuenta de Auth siga existiendo.
--   * private.has_module(m) reemplaza a private.is_admin() en las policies de
--     cada módulo: el admin pasa siempre; el resto, solo si tiene `m`.
--   * profiles.last_sign_in_at (copiado de auth.users por trigger) le dice a
--     la pantalla de Usuarios quién ya aceptó la invitación.
--
-- La invitación por correo NO usa la service_role: la manda Supabase Auth
-- con la clave pública (signInWithOtp), y el trigger on_auth_user_created de
-- Fase 1 sigue rechazando a quien no esté en allowed_emails.
--
-- Idempotente: se puede correr más de una vez (pegado en el SQL Editor).

-- ============================================================================
-- 1. Columnas nuevas
-- ============================================================================
alter table public.allowed_emails
  add column if not exists modules    text[]      not null default '{}',
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by uuid        references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'planilla', 'asistencia', 'contratistas']::text[]);

comment on column public.allowed_emails.modules is
  'Módulos a los que entra un usuario con role vendedor. El admin entra a todo y esto se ignora.';
comment on column public.allowed_emails.invited_at is 'Última vez que se le envió la invitación por correo.';

create unique index if not exists allowed_emails_email_lower_key on public.allowed_emails (lower(email));

alter table public.profiles
  add column if not exists modules         text[]      not null default '{}',
  add column if not exists last_sign_in_at timestamptz;

comment on column public.profiles.modules is
  'Copia de allowed_emails.modules (la mantiene private.sync_profile_from_allowed_email). No se edita directo.';

-- Antes de esto un vendedor entraba al Cotizador: lo conserva.
update public.allowed_emails set modules = array['cotizacion'] where role = 'vendedor' and modules = '{}';
update public.profiles       set modules = array['cotizacion'] where role = 'vendedor' and modules = '{}';

update public.profiles p
   set last_sign_in_at = u.last_sign_in_at
  from auth.users u
 where u.id = p.id and p.last_sign_in_at is null;

drop trigger if exists allowed_emails_touch_updated_at on public.allowed_emails;
create trigger allowed_emails_touch_updated_at
  before update on public.allowed_emails
  for each row execute function private.touch_updated_at();

-- ============================================================================
-- 2. private.has_module — lo que llaman las policies
-- ============================================================================
create or replace function private.has_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' or p_module = any (p.modules)
       from public.profiles p
      where p.id = (select auth.uid())),
    false
  );
$$;

comment on function private.has_module(text) is
  'True si el usuario actual es admin o tiene el módulo asignado. Lo usan las policies de cada módulo.';

revoke all on function private.has_module(text) from public;
grant execute on function private.has_module(text) to authenticated;

-- ============================================================================
-- 3. Alta en Auth: el perfil nace con role + modules de la lista
-- ============================================================================
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    text;
  v_modules text[];
begin
  select role, modules into v_role, v_modules
  from public.allowed_emails
  where lower(email) = lower(new.email);

  if v_role is null then
    raise exception 'ACCESO_NO_AUTORIZADO: % no esta en la lista de correos autorizados', new.email
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role, modules, last_sign_in_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_role,
    coalesce(v_modules, '{}'),
    new.last_sign_in_at
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

-- ============================================================================
-- 4. allowed_emails → profiles
-- ============================================================================
create or replace function private.sync_profile_from_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.profiles where lower(email) = lower(old.email);
    return old;
  end if;

  if tg_op = 'UPDATE' and lower(new.email) is distinct from lower(old.email) then
    raise exception 'No se puede cambiar el correo de un usuario: quítalo e invítalo de nuevo';
  end if;

  update public.profiles
     set role = new.role, modules = new.modules
   where lower(email) = lower(new.email);

  -- Alguien que ya tenía cuenta (ej. lo quitaron y lo vuelven a agregar):
  -- su perfil se recrea desde auth.users.
  if not found then
    insert into public.profiles (id, email, full_name, avatar_url, role, modules, last_sign_in_at)
    select u.id,
           u.email,
           coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
           u.raw_user_meta_data ->> 'avatar_url',
           new.role,
           new.modules,
           u.last_sign_in_at
      from auth.users u
     where lower(u.email) = lower(new.email)
    on conflict (id) do update
      set role = excluded.role, modules = excluded.modules;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_profile_from_allowed_email() from public;

drop trigger if exists allowed_emails_sync_profile on public.allowed_emails;
create trigger allowed_emails_sync_profile
  after insert or update or delete on public.allowed_emails
  for each row execute function private.sync_profile_from_allowed_email();

-- ============================================================================
-- 5. auth.users.last_sign_in_at → profiles
-- ============================================================================
create or replace function private.sync_profile_last_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set last_sign_in_at = new.last_sign_in_at where id = new.id;
  return new;
end;
$$;

revoke all on function private.sync_profile_last_sign_in() from public;
grant execute on function private.sync_profile_last_sign_in() to supabase_auth_admin;

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function private.sync_profile_last_sign_in();

-- ============================================================================
-- 6. Un no-admin tampoco puede darse módulos a sí mismo
-- ============================================================================
create or replace function private.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'No puedes cambiar tu propio rol';
    end if;
    if new.modules is distinct from old.modules then
      raise exception 'No puedes cambiar tus propios permisos';
    end if;
    if new.id is distinct from old.id
       or lower(new.email) is distinct from lower(old.email) then
      raise exception 'No puedes cambiar id o email del perfil';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 7. Policies por módulo (reemplazan las solo-admin)
-- ============================================================================
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('payroll_employees',             'planilla'),
      ('payroll_entries',               'planilla'),
      ('payroll_ledger_entries',        'planilla'),
      ('payroll_loans',                 'planilla'),
      ('payroll_salary_changes',        'planilla'),
      ('payroll_positions',             'planilla'),
      ('payroll_indrive_rides',         'planilla'),
      ('contractors',                   'contratistas'),
      ('projects',                      'contratistas'),
      ('contractor_ledger_entries',     'contratistas'),
      ('contractor_ledger_entry_items', 'contratistas'),
      ('project_assignments',           'contratistas'),
      ('labor_rates',                   'contratistas'),
      ('contractor_helpers',            'contratistas'),
      ('quote_item_recipes',            'costos')
    ) as t (tbl, module)
  loop
    -- Una tabla de una migración todavía sin aplicar se salta.
    if to_regclass('public.' || r.tbl) is null then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', r.tbl || '_admin_all', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_module_all', r.tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.has_module(%L)) with check (private.has_module(%L))',
      r.tbl || '_module_all', r.tbl, r.module, r.module
    );
  end loop;
end;
$$;

-- Fotos de empleados (bucket privado de Planilla).
drop policy if exists "employee_photos_admin_all" on storage.objects;
drop policy if exists "employee_photos_module_all" on storage.objects;
create policy "employee_photos_module_all"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'employee-photos' and private.has_module('planilla'))
  with check (bucket_id = 'employee-photos' and private.has_module('planilla'));

-- Cotizador: insumos y catálogo los lee quien cotiza; los cambia quien tiene Costos.
drop policy if exists "quote_cost_inputs_read"         on public.quote_cost_inputs;
drop policy if exists "quote_cost_inputs_admin_insert" on public.quote_cost_inputs;
drop policy if exists "quote_cost_inputs_admin_update" on public.quote_cost_inputs;
drop policy if exists "quote_cost_inputs_admin_delete" on public.quote_cost_inputs;
drop policy if exists "quote_cost_inputs_module_read"  on public.quote_cost_inputs;
drop policy if exists "quote_cost_inputs_costos_write" on public.quote_cost_inputs;
create policy "quote_cost_inputs_module_read" on public.quote_cost_inputs for select to authenticated
  using (private.has_module('cotizacion') or private.has_module('costos'));
create policy "quote_cost_inputs_costos_write" on public.quote_cost_inputs for all to authenticated
  using (private.has_module('costos')) with check (private.has_module('costos'));

drop policy if exists "quote_catalog_items_read"         on public.quote_catalog_items;
drop policy if exists "quote_catalog_items_admin_insert" on public.quote_catalog_items;
drop policy if exists "quote_catalog_items_admin_update" on public.quote_catalog_items;
drop policy if exists "quote_catalog_items_admin_delete" on public.quote_catalog_items;
drop policy if exists "quote_catalog_items_module_read"  on public.quote_catalog_items;
drop policy if exists "quote_catalog_items_costos_write" on public.quote_catalog_items;
create policy "quote_catalog_items_module_read" on public.quote_catalog_items for select to authenticated
  using (private.has_module('cotizacion') or private.has_module('costos'));
create policy "quote_catalog_items_costos_write" on public.quote_catalog_items for all to authenticated
  using (private.has_module('costos')) with check (private.has_module('costos'));

-- Cotizaciones: quien tiene el Cotizador.
drop policy if exists "quotes_app_users_all"         on public.quotes;
drop policy if exists "quote_sections_app_users_all" on public.quote_sections;
drop policy if exists "quote_lines_app_users_all"    on public.quote_lines;
drop policy if exists "quotes_module_all"            on public.quotes;
drop policy if exists "quote_sections_module_all"    on public.quote_sections;
drop policy if exists "quote_lines_module_all"       on public.quote_lines;
create policy "quotes_module_all" on public.quotes for all to authenticated
  using (private.has_module('cotizacion')) with check (private.has_module('cotizacion'));
create policy "quote_sections_module_all" on public.quote_sections for all to authenticated
  using (private.has_module('cotizacion')) with check (private.has_module('cotizacion'));
create policy "quote_lines_module_all" on public.quote_lines for all to authenticated
  using (private.has_module('cotizacion')) with check (private.has_module('cotizacion'));
