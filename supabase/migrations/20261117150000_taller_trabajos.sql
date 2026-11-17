-- Taller · Etapa 1: Trabajos (por ahora el tipo CNC). Ver TALLER-PLAN.md.
--
--  * Permiso nuevo `taller`: ver, crear, editar y borrar trabajos (diseñadoras, jefe de taller, operario).
--  * `work_orders`: un encargo concreto para una persona de Personal (responsable), pedido por un usuario,
--    de un proyecto o interno del taller (project_id null). `production_order_id` queda para la etapa 3.
--  * `work_order_files`: archivos del trabajo; viven en Google Drive (la app es la única puerta).
--  * `work_order_events`: historial (creado, estado, editado, archivos) para medir tiempos y atrasos.
--  * Avisos dirigidos: `app_notifications.target_user_ids` (si viene, solo a esos usuarios).

-- 1. El permiso.
alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'proyectos', 'planilla', 'asistencia', 'contratistas', 'documentos',
                          'almacen', 'almacen_compras', 'almacen_costos', 'almacen_ajustes', 'almacen_herramientas', 'directorio',
                          'accesos', 'form_autorizaciones', 'form_registro', 'inspecciones', 'diseno', 'taller']::text[]);

-- 2. Trabajos.
create table if not exists public.work_orders (
  id                    uuid primary key default gen_random_uuid(),
  kind                  text not null default 'cnc' check (kind in ('cnc')),
  title                 text not null check (length(btrim(title)) > 0),
  project_id            uuid references public.projects(id) on delete set null,
  production_order_id   uuid,
  assignee_employee_id  uuid references public.payroll_employees(id) on delete set null,
  requested_by          uuid references public.profiles(id) on delete set null default auth.uid(),
  status                text not null default 'por_hacer' check (status in ('por_hacer', 'en_proceso', 'listo', 'cancelado')),
  due_date              date,
  started_at            timestamptz,
  done_at               timestamptz,
  notes                 text,
  drive_folder_id       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists work_orders_status_idx on public.work_orders (status, due_date);
create index if not exists work_orders_project_idx on public.work_orders (project_id);
create index if not exists work_orders_assignee_idx on public.work_orders (assignee_employee_id);

create table if not exists public.work_order_files (
  id             uuid primary key default gen_random_uuid(),
  work_order_id  uuid not null references public.work_orders(id) on delete cascade,
  drive_file_id  text not null,
  name           text not null,
  mime_type      text,
  size_bytes     bigint,
  uploaded_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists work_order_files_order_idx on public.work_order_files (work_order_id);
create unique index if not exists work_order_files_drive_idx on public.work_order_files (drive_file_id);

create table if not exists public.work_order_events (
  id             bigserial primary key,
  work_order_id  uuid not null references public.work_orders(id) on delete cascade,
  actor_id       uuid references public.profiles(id) on delete set null default auth.uid(),
  kind           text not null check (kind in ('creado', 'estado', 'editado', 'responsable', 'archivo_agregado', 'archivo_borrado')),
  from_status    text,
  to_status      text,
  detail         text,
  created_at     timestamptz not null default now()
);
create index if not exists work_order_events_order_idx on public.work_order_events (work_order_id, created_at);

-- 3. Permisos: todo el que tiene Taller (y el admin) ve, crea, edita y borra.
alter table public.work_orders enable row level security;
alter table public.work_order_files enable row level security;
alter table public.work_order_events enable row level security;

drop policy if exists "work_orders_taller" on public.work_orders;
create policy "work_orders_taller" on public.work_orders for all to authenticated
  using (private.has_module('taller')) with check (private.has_module('taller'));
drop policy if exists "work_order_files_taller" on public.work_order_files;
create policy "work_order_files_taller" on public.work_order_files for all to authenticated
  using (private.has_module('taller')) with check (private.has_module('taller'));
drop policy if exists "work_order_events_taller_read" on public.work_order_events;
create policy "work_order_events_taller_read" on public.work_order_events for select to authenticated
  using (private.has_module('taller'));
grant select, insert, update, delete on public.work_orders, public.work_order_files to authenticated;
grant select on public.work_order_events to authenticated;

-- 4. Avisos dirigidos a usuarios concretos.
alter table public.app_notifications add column if not exists target_user_ids uuid[];

create or replace function private.fanout_app_notification_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.target_user_ids is not null then
    insert into public.app_notification_recipients (notification_id, user_id)
    select new.id, p.id from public.profiles p where p.id = any (new.target_user_ids)
    on conflict do nothing;
    return null;
  end if;
  insert into public.app_notification_recipients (notification_id, user_id)
  select new.id, p.id from public.profiles p
  where p.role = 'admin' or new.module = any(coalesce(p.modules, '{}'::text[]))
  on conflict do nothing;
  return null;
end; $$;

insert into public.notification_types (key, module, title, description, default_push, sort_order) values
  ('taller_assigned', 'taller', 'Nuevo trabajo asignado', 'Te asignaron un trabajo en Taller (por ejemplo, un corte de CNC).', true, 150),
  ('taller_done', 'taller', 'Trabajo listo', 'Un trabajo que pediste quedó listo.', true, 160)
on conflict (key) do update set module = excluded.module, title = excluded.title,
  description = excluded.description, default_push = excluded.default_push, sort_order = excluded.sort_order;

-- El usuario de la app de una persona de Personal (null si todavía no tiene acceso).
create or replace function private.user_of_employee(p_employee uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id
    from public.allowed_emails a
    join public.profiles p on lower(p.email) = lower(a.email)
   where a.employee_id = p_employee
   limit 1
$$;
revoke all on function private.user_of_employee(uuid) from public, anon;

-- 5. Historial, fechas de inicio/fin y avisos (en la base: así nadie se los salta).
create or replace function private.work_order_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'en_proceso' and new.started_at is null then new.started_at := now(); end if;
    if new.status = 'listo' then new.done_at := now(); end if;
    if new.status in ('por_hacer', 'en_proceso') then new.done_at := null; end if;
    if new.status = 'por_hacer' then new.started_at := null; end if;
  end if;
  return new;
end; $$;
drop trigger if exists work_orders_before on public.work_orders;
create trigger work_orders_before before insert or update on public.work_orders
  for each row execute function private.work_order_before();

create or replace function private.work_order_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_assignee_user uuid;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_href text := '/taller?trabajo=' || new.id;
begin
  select coalesce(nullif(btrim(p.full_name), ''), p.email) into v_actor_name from public.profiles p where p.id = v_actor;

  if tg_op = 'INSERT' then
    insert into public.work_order_events (work_order_id, kind, to_status) values (new.id, 'creado', new.status);
  else
    if new.status is distinct from old.status then
      insert into public.work_order_events (work_order_id, kind, from_status, to_status) values (new.id, 'estado', old.status, new.status);
    end if;
    if new.assignee_employee_id is distinct from old.assignee_employee_id then
      insert into public.work_order_events (work_order_id, kind, detail)
      values (new.id, 'responsable', (select e.name from public.payroll_employees e where e.id = new.assignee_employee_id));
    end if;
    if (new.title, new.project_id, new.due_date, new.notes) is distinct from (old.title, old.project_id, old.due_date, old.notes) then
      insert into public.work_order_events (work_order_id, kind) values (new.id, 'editado');
    end if;
  end if;

  -- Aviso al responsable cuando se le asigna (al crear o al cambiar de responsable), si tiene usuario y no es quien lo hizo.
  if new.assignee_employee_id is not null and new.status not in ('listo', 'cancelado')
     and (tg_op = 'INSERT' or new.assignee_employee_id is distinct from old.assignee_employee_id) then
    v_assignee_user := private.user_of_employee(new.assignee_employee_id);
    if v_assignee_user is not null and v_assignee_user is distinct from v_actor then
      insert into public.app_notifications (kind, type_key, module, title, body, href, actor_id, actor_name, target_user_ids)
      values ('taller_assigned', 'taller_assigned', 'taller', 'Nuevo trabajo asignado', new.title, v_href, v_actor, v_actor_name, array[v_assignee_user]);
    end if;
  end if;

  -- Aviso a quien lo pidió cuando queda listo (si no fue él mismo quien lo marcó).
  if tg_op = 'UPDATE' and new.status = 'listo' and old.status is distinct from 'listo'
     and new.requested_by is not null and new.requested_by is distinct from v_actor then
    insert into public.app_notifications (kind, type_key, module, title, body, href, actor_id, actor_name, target_user_ids)
    values ('taller_done', 'taller_done', 'taller', 'Trabajo listo', new.title, v_href, v_actor, v_actor_name, array[new.requested_by]);
  end if;
  return null;
end; $$;
drop trigger if exists work_orders_after on public.work_orders;
create trigger work_orders_after after insert or update on public.work_orders
  for each row execute function private.work_order_after();

create or replace function private.work_order_file_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_events (work_order_id, kind, detail) values (new.work_order_id, 'archivo_agregado', new.name);
    return null;
  end if;
  -- Al borrar el trabajo entero (cascada) ya no hay a qué anotarlo.
  if exists (select 1 from public.work_orders w where w.id = old.work_order_id) then
    insert into public.work_order_events (work_order_id, kind, detail) values (old.work_order_id, 'archivo_borrado', old.name);
  end if;
  return null;
end; $$;
drop trigger if exists work_order_files_event on public.work_order_files;
create trigger work_order_files_event after insert or delete on public.work_order_files
  for each row execute function private.work_order_file_event();
