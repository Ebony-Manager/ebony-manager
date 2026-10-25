-- Asistencia sin Planilla (ej. jefa de taller) y avisos al admin.
--
-- 1) Asistencia ya no pide Planilla (en la app cuelga de Personal). Quien
--    tiene Asistencia sin Planilla no puede leer payroll_employees (salarios,
--    cuentas…); para armar la quincena de ponchadas lee solo lo mínimo de los
--    empleados activos con attendance_roster().
-- 2) app_notifications: avisos para los admin. Cada ajuste de un día de
--    asistencia (revisar / deshacer) hecho por alguien que no es admin deja
--    un aviso, desde un trigger: no depende de la pantalla. Más adelante esto
--    mismo alimenta las notificaciones al celular.

-- 1) Lista mínima de empleados para Asistencia ─────────────────────────────
create or replace function public.attendance_roster()
returns table (id uuid, name text, status text, categoria text, start_date date, end_date date, sort_order integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name::text, e.status::text, e.categoria::text, e.start_date::date, e.end_date::date, e.sort_order::integer
    from public.payroll_employees e
   where private.has_module('asistencia') and e.status = 'ACTIVE'
   order by e.sort_order, e.name;
$$;
revoke all on function public.attendance_roster() from public, anon;
grant execute on function public.attendance_roster() to authenticated;

-- 2) Avisos ─────────────────────────────────────────────────────────────────
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  body text,
  href text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists app_notifications_unseen_idx on public.app_notifications (created_at desc) where seen_at is null;
alter table public.app_notifications enable row level security;

drop policy if exists "app_notifications_admin_read" on public.app_notifications;
create policy "app_notifications_admin_read" on public.app_notifications for select to authenticated using (private.is_admin());
drop policy if exists "app_notifications_admin_update" on public.app_notifications;
create policy "app_notifications_admin_update" on public.app_notifications for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
-- Sin política de insert: solo los triggers (security definer) escriben.

create or replace function private.notify_attendance_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee uuid;
  v_day date;
  v_emp text;
  v_actor text;
  v_what text;
  v_note text;
begin
  if private.is_admin() then
    return null;
  end if;
  if tg_op = 'DELETE' then
    v_employee := old.employee_id;
    v_day := old.day;
    v_what := 'se deshizo la revisión';
  else
    v_employee := new.employee_id;
    v_day := new.day;
    v_note := nullif(trim(new.note), '');
    if new.arrival_minutes is null and new.departure_minutes is null then
      v_what := 'marcado: no vino';
    else
      v_what := concat_ws(' · ',
        case when new.arrival_minutes is not null
          then 'entrada ' || (new.arrival_minutes / 60)::text || ':' || lpad((new.arrival_minutes % 60)::text, 2, '0') end,
        case when new.departure_minutes is not null
          then 'salida ' || (new.departure_minutes / 60)::text || ':' || lpad((new.departure_minutes % 60)::text, 2, '0') end);
    end if;
  end if;
  select e.name into v_emp from public.payroll_employees e where e.id = v_employee;
  select coalesce(nullif(p.full_name, ''), p.email) into v_actor from public.profiles p where p.id = (select auth.uid());

  insert into public.app_notifications (kind, title, body, href, actor_id, actor_name)
  values (
    'asistencia_ajuste',
    'Ajuste de asistencia',
    concat_ws(' · ', coalesce(v_emp, 'Empleado'), to_char(v_day, 'DD/MM/YYYY'), v_what, '“' || v_note || '”'),
    '/personal/pagos?tab=asistencia',
    (select auth.uid()),
    v_actor
  );
  return null;
end;
$$;

drop trigger if exists attendance_day_resolutions_notify on public.attendance_day_resolutions;
create trigger attendance_day_resolutions_notify
  after insert or update or delete on public.attendance_day_resolutions
  for each row execute function private.notify_attendance_adjustment();
