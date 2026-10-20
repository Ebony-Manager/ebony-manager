-- Nombre y apellido de cada usuario, puestos por el admin al invitar.
--
-- Hasta ahora el nombre salía solo de la cuenta de Google (o no había, si la
-- persona entró con el enlace del correo). Ahora `allowed_emails` guarda
-- first_name / last_name; si están, mandan sobre el nombre de Google y se
-- copian a `profiles.full_name`, que es lo que muestra la app.
--
-- Sin sentencias que borren objetos (ver usuarios_permisos): las funciones
-- se reemplazan con CREATE OR REPLACE. Idempotente.

alter table public.allowed_emails
  add column if not exists first_name text,
  add column if not exists last_name  text;

comment on column public.allowed_emails.first_name is 'Nombre, puesto por el admin. Si hay nombre o apellido, manda sobre el de Google.';
comment on column public.allowed_emails.last_name is 'Apellido, puesto por el admin.';

-- "Nombre Apellido", o NULL si no hay ninguno de los dos.
create or replace function private.allowed_full_name(p_first text, p_last text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(concat_ws(' ', nullif(trim(p_first), ''), nullif(trim(p_last), '')), '');
$$;

revoke all on function private.allowed_full_name(text, text) from public;

-- ============================================================================
-- Alta en Auth: el perfil nace con el nombre de la lista (si hay)
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
  v_name    text;
begin
  select role, modules, private.allowed_full_name(first_name, last_name)
    into v_role, v_modules, v_name
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
    coalesce(v_name, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
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
-- allowed_emails → profiles: también el nombre
-- ============================================================================
create or replace function private.sync_profile_from_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.profiles where lower(email) = lower(old.email);
    return old;
  end if;

  if tg_op = 'UPDATE' and lower(new.email) is distinct from lower(old.email) then
    raise exception 'No se puede cambiar el correo de un usuario: quítalo e invítalo de nuevo';
  end if;

  v_name := private.allowed_full_name(new.first_name, new.last_name);

  update public.profiles
     set role = new.role,
         modules = new.modules,
         full_name = coalesce(v_name, full_name)
   where lower(email) = lower(new.email);

  -- Alguien que ya tenía cuenta (ej. lo quitaron y lo vuelven a agregar):
  -- su perfil se recrea desde auth.users.
  if not found then
    insert into public.profiles (id, email, full_name, avatar_url, role, modules, last_sign_in_at)
    select u.id,
           u.email,
           coalesce(v_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
           u.raw_user_meta_data ->> 'avatar_url',
           new.role,
           new.modules,
           u.last_sign_in_at
      from auth.users u
     where lower(u.email) = lower(new.email)
    on conflict (id) do update
      set role = excluded.role, modules = excluded.modules, full_name = excluded.full_name;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- Los que ya estaban: nombre y apellido sacados de su nombre de Google
-- (primera palabra = nombre, el resto = apellido). El admin lo corrige luego.
-- ============================================================================
update public.allowed_emails a
   set first_name = split_part(src.name, ' ', 1),
       last_name  = nullif(trim(substr(src.name, length(split_part(src.name, ' ', 1)) + 1)), '')
  from (
    select lower(u.email) as email,
           trim(coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')) as name
      from auth.users u
      left join public.profiles p on p.id = u.id
  ) src
 where lower(a.email) = src.email
   and coalesce(src.name, '') <> ''
   and a.first_name is null
   and a.last_name is null;
