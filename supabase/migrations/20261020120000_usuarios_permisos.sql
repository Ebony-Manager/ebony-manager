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
-- Sin sentencias que borren objetos, a propósito (el MCP de Supabase pide
-- confirmarlas una por una y en una sesión sin pantalla se queda esperando):
-- las policies viejas se renombran y se modifican con ALTER POLICY, los
-- triggers usan CREATE OR REPLACE y el check se agrega solo si falta.

-- ============================================================================
-- 1. Columnas nuevas
-- ============================================================================
alter table public.allowed_emails
  add column if not exists modules    text[]      not null default '{}',
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by uuid        references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'allowed_emails_modules_check') then
    alter table public.allowed_emails add constraint allowed_emails_modules_check
      check (modules <@ array['cotizacion', 'costos', 'planilla', 'asistencia', 'contratistas']::text[]);
  end if;
end;
$$;

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

create or replace trigger allowed_emails_touch_updated_at
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

create or replace trigger allowed_emails_sync_profile
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

create or replace trigger on_auth_user_signed_in
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
--    Cada fila: la policy vieja (si existe) se renombra a la nueva y se le
--    cambia la condición; si no hay ninguna de las dos, se crea la nueva.
--    Una tabla de una migración todavía sin aplicar (ej. payroll_indrive_rides)
--    se salta: volver a correr esto después de crearla.
-- ============================================================================
do $$
declare
  r    record;
  stmt text;
begin
  for r in
    select * from (values
      ('public',  'payroll_employees',             'payroll_employees_admin_all',             'payroll_employees_module_all',             'all',    $p$private.has_module('planilla')$p$,     $p$private.has_module('planilla')$p$),
      ('public',  'payroll_entries',               'payroll_entries_admin_all',               'payroll_entries_module_all',               'all',    $p$private.has_module('planilla')$p$,     $p$private.has_module('planilla')$p$),
      ('public',  'payroll_ledger_entries',        'payroll_ledger_entries_admin_all',        'payroll_ledger_entries_module_all',        'all',    $p$private.has_module('planilla')$p$,     $p$private.has_module('planilla')$p$),
      ('public',  'payroll_loans',                 'payroll_loans_admin_all',                 'payroll_loans_module_all',                 'all',    $p$private.has_module('planilla')$p$,     $p$private.has_module('planilla')$p$),
      ('public',  'payroll_salary_changes',        'payroll_salary_changes_admin_all',        'payroll_salary_changes_module_all',        'all',    $p$private.has_module('planilla')$p$,     $p$private.has_module('planilla')$p$),
      ('public',  'payroll_positions',             'payroll_positions_admin_all',             'payroll_positions_module_all',             'all',    $p$private.has_module('planilla')$p$,     $p$private.has_module('planilla')$p$),
      ('public',  'payroll_indrive_rides',         'payroll_indrive_rides_admin_all',         'payroll_indrive_rides_module_all',         'all',    $p$private.has_module('planilla')$p$,     $p$private.has_module('planilla')$p$),
      ('public',  'contractors',                   'contractors_admin_all',                   'contractors_module_all',                   'all',    $p$private.has_module('contratistas')$p$, $p$private.has_module('contratistas')$p$),
      ('public',  'projects',                      'projects_admin_all',                      'projects_module_all',                      'all',    $p$private.has_module('contratistas')$p$, $p$private.has_module('contratistas')$p$),
      ('public',  'contractor_ledger_entries',     'contractor_ledger_entries_admin_all',     'contractor_ledger_entries_module_all',     'all',    $p$private.has_module('contratistas')$p$, $p$private.has_module('contratistas')$p$),
      ('public',  'contractor_ledger_entry_items', 'contractor_ledger_entry_items_admin_all', 'contractor_ledger_entry_items_module_all', 'all',    $p$private.has_module('contratistas')$p$, $p$private.has_module('contratistas')$p$),
      ('public',  'project_assignments',           'project_assignments_admin_all',           'project_assignments_module_all',           'all',    $p$private.has_module('contratistas')$p$, $p$private.has_module('contratistas')$p$),
      ('public',  'labor_rates',                   'labor_rates_admin_all',                   'labor_rates_module_all',                   'all',    $p$private.has_module('contratistas')$p$, $p$private.has_module('contratistas')$p$),
      ('public',  'contractor_helpers',            'contractor_helpers_admin_all',            'contractor_helpers_module_all',            'all',    $p$private.has_module('contratistas')$p$, $p$private.has_module('contratistas')$p$),
      -- Cotizador: las cotizaciones, quien tiene el Cotizador; las recetas, quien tiene Costos.
      ('public',  'quotes',                        'quotes_app_users_all',                    'quotes_module_all',                        'all',    $p$private.has_module('cotizacion')$p$,   $p$private.has_module('cotizacion')$p$),
      ('public',  'quote_sections',                'quote_sections_app_users_all',            'quote_sections_module_all',                'all',    $p$private.has_module('cotizacion')$p$,   $p$private.has_module('cotizacion')$p$),
      ('public',  'quote_lines',                   'quote_lines_app_users_all',               'quote_lines_module_all',                   'all',    $p$private.has_module('cotizacion')$p$,   $p$private.has_module('cotizacion')$p$),
      ('public',  'quote_item_recipes',            'quote_item_recipes_admin_all',            'quote_item_recipes_module_all',            'all',    $p$private.has_module('costos')$p$,       $p$private.has_module('costos')$p$),
      -- Insumos y catálogo: los lee quien cotiza; los cambia quien tiene Costos.
      ('public',  'quote_cost_inputs',             'quote_cost_inputs_read',                  'quote_cost_inputs_module_read',            'select', $p$private.has_module('cotizacion') or private.has_module('costos')$p$, null),
      ('public',  'quote_cost_inputs',             'quote_cost_inputs_admin_insert',          'quote_cost_inputs_costos_insert',          'insert', null,                                     $p$private.has_module('costos')$p$),
      ('public',  'quote_cost_inputs',             'quote_cost_inputs_admin_update',          'quote_cost_inputs_costos_update',          'update', $p$private.has_module('costos')$p$,       $p$private.has_module('costos')$p$),
      ('public',  'quote_cost_inputs',             'quote_cost_inputs_admin_delete',          'quote_cost_inputs_costos_delete',          'delete', $p$private.has_module('costos')$p$,       null),
      ('public',  'quote_catalog_items',           'quote_catalog_items_read',                'quote_catalog_items_module_read',          'select', $p$private.has_module('cotizacion') or private.has_module('costos')$p$, null),
      ('public',  'quote_catalog_items',           'quote_catalog_items_admin_insert',        'quote_catalog_items_costos_insert',        'insert', null,                                     $p$private.has_module('costos')$p$),
      ('public',  'quote_catalog_items',           'quote_catalog_items_admin_update',        'quote_catalog_items_costos_update',        'update', $p$private.has_module('costos')$p$,       $p$private.has_module('costos')$p$),
      ('public',  'quote_catalog_items',           'quote_catalog_items_admin_delete',        'quote_catalog_items_costos_delete',        'delete', $p$private.has_module('costos')$p$,       null)
    ) as t (sch, tbl, old_name, new_name, cmd, using_expr, check_expr)
  loop
    if to_regclass(format('%I.%I', r.sch, r.tbl)) is null then
      continue;
    end if;

    if exists (select 1 from pg_policies where schemaname = r.sch and tablename = r.tbl and policyname = r.old_name)
       and not exists (select 1 from pg_policies where schemaname = r.sch and tablename = r.tbl and policyname = r.new_name) then
      execute format('alter policy %I on %I.%I rename to %I', r.old_name, r.sch, r.tbl, r.new_name);
    end if;

    if exists (select 1 from pg_policies where schemaname = r.sch and tablename = r.tbl and policyname = r.new_name) then
      stmt := format('alter policy %I on %I.%I to authenticated', r.new_name, r.sch, r.tbl);
    else
      stmt := format('create policy %I on %I.%I for %s to authenticated', r.new_name, r.sch, r.tbl, r.cmd);
    end if;
    if r.using_expr is not null then
      stmt := stmt || ' using (' || r.using_expr || ')';
    end if;
    if r.check_expr is not null then
      stmt := stmt || ' with check (' || r.check_expr || ')';
    end if;
    execute stmt;
  end loop;
end;
$$;

-- Fotos de empleados (bucket privado de Planilla). storage.objects es del
-- servicio de Storage: se le pueden crear policies pero no renombrarlas ni
-- cambiarlas. Se agrega la de módulo al lado de la vieja; las policies se
-- suman con OR, así que `employee_photos_admin_all` queda redundante.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'employee_photos_module_all') then
    create policy "employee_photos_module_all"
      on storage.objects for all
      to authenticated
      using (bucket_id = 'employee-photos' and private.has_module('planilla'))
      with check (bucket_id = 'employee-photos' and private.has_module('planilla'));
  end if;
end;
$$;
