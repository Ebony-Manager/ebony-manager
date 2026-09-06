-- Fase 1 — Supabase Auth + Row-Level Security foundation for Ebony.
--
-- Model
--   * Every person who signs in gets one row in public.profiles, keyed by
--     their auth.users id, carrying an app role: 'admin' or 'vendedor'.
--   * Access is allow-listed: public.allowed_emails lists who may sign in
--     at all. A Google account whose email is not on the list is rejected
--     during signup by the on_auth_user_created trigger (the auth.users
--     insert is rolled back, so no orphan user is left behind).
--   * RLS is ON for every table here. Nothing is readable by the anon
--     role. 'vendedor' sees only its own profile; 'admin' sees and edits
--     everything and is the only role that can touch allowed_emails or
--     change another profile's role.
--
-- Security notes
--   * Role/trigger helper functions live in a dedicated `private` schema,
--     never in `public`, so PostgREST does not expose them as RPC
--     endpoints (Supabase linter 0028/0029).
--   * The two functions that RLS policies call (is_admin, current_app_role)
--     are SECURITY DEFINER on purpose: they read public.profiles, and the
--     profiles policies call them — without DEFINER that recurses.
--
-- This file is the source of truth for the schema. It is applied to the
-- remote project via the Supabase MCP / dashboard (no local CLI linked
-- yet — see supabase/README.md).

-- ============================================================================
-- 0. private schema for helper + trigger functions (not PostgREST-exposed)
-- ============================================================================
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant usage on schema private to supabase_auth_admin;

-- ============================================================================
-- 1. profiles
-- ============================================================================
create table public.profiles (
  id         uuid        primary key references auth.users (id) on delete cascade,
  email      text        not null,
  full_name  text,
  avatar_url text,
  role       text        not null default 'vendedor'
                         check (role in ('admin', 'vendedor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'App profile + role for each authenticated user. Rows are created by private.handle_new_user() on signup, never by the client.';

alter table public.profiles enable row level security;

-- ============================================================================
-- 2. allowed_emails  (the allow-list)
-- ============================================================================
create table public.allowed_emails (
  email      text        primary key,
  role       text        not null default 'vendedor'
                         check (role in ('admin', 'vendedor')),
  note       text,
  created_at timestamptz not null default now()
);

comment on table public.allowed_emails is
  'Allow-list of emails permitted to sign in. Checked by private.handle_new_user(); non-listed accounts are rejected at signup. Admin-only.';

alter table public.allowed_emails enable row level security;

-- ============================================================================
-- 3. Role helpers  (private, SECURITY DEFINER, empty search_path)
-- ============================================================================
create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'admin', false);
$$;

comment on function private.is_admin() is
  'True when the current user''s profile role is admin. Called by RLS policies.';

revoke all on function private.current_app_role() from public;
revoke all on function private.is_admin()          from public;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_admin()          to authenticated;

-- ============================================================================
-- 4. Signup handling: allow-list enforcement + profile seed
-- ============================================================================
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.allowed_emails
  where lower(email) = lower(new.email);

  if v_role is null then
    raise exception 'ACCESO_NO_AUTORIZADO: % no esta en la lista de correos autorizados', new.email
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_role
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
grant execute on function private.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- keep profiles.updated_at honest
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- a non-admin may edit their own profile, but not escalate role or
-- rewrite identity columns
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
    if new.id is distinct from old.id
       or lower(new.email) is distinct from lower(old.email) then
      raise exception 'No puedes cambiar id o email del perfil';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_profile_privileged_columns() from public;

create trigger profiles_protect_privileged_columns
  before update on public.profiles
  for each row execute function private.protect_profile_privileged_columns();

-- ============================================================================
-- 5. RLS policies
-- ============================================================================

-- profiles: own row for everyone, all rows for admins.
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or private.is_admin());

create policy "profiles_update_self_or_admin"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) or private.is_admin())
  with check (id = (select auth.uid()) or private.is_admin());

-- No INSERT/DELETE policy on purpose: profiles are born in the
-- on_auth_user_created trigger and die with their auth.users row.

-- allowed_emails: admins only, invisible to everyone else.
create policy "allowed_emails_admin_all"
  on public.allowed_emails for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ============================================================================
-- 6. Grants — anon gets nothing; authenticated is still filtered by RLS
-- ============================================================================
revoke all on public.profiles      from anon;
revoke all on public.allowed_emails from anon;
grant select, update                 on public.profiles       to authenticated;
grant select, insert, update, delete on public.allowed_emails to authenticated;

-- ============================================================================
-- 7. Bootstrap admin so the deployed app is reachable.
--    Add the rest of the team from inside the app once signed in.
-- ============================================================================
insert into public.allowed_emails (email, role, note)
values ('teofilohafeitz@gmail.com', 'admin', 'Fase 1 bootstrap admin')
on conflict (email) do nothing;
