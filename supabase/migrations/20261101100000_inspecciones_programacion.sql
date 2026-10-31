-- Programación de detalles de inspección: qué detalle atiende quién y qué día
-- (con orden, sin horas). Cada programación es una fila: al reprogramar, la
-- anterior queda "reprogramado" y nace otra, así se ve la historia y se mide el
-- cumplimiento. Cuando la supervisora marca el detalle Resuelto, su
-- programación abierta pasa sola a "hecho".

create table if not exists public.inspection_schedules (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.inspection_items (id) on delete cascade,
  person_kind     text not null check (person_kind in ('empleado', 'contratista')),
  person_id       uuid not null,
  person_name     text not null,
  scheduled_on    date not null,
  sort_order      integer not null default 0,
  note            text,
  outcome         text not null default 'programado' check (outcome in ('programado', 'hecho', 'reprogramado', 'cancelado')),
  closed_at       timestamptz,
  created_by      uuid default auth.uid(),
  created_by_name text,
  created_at      timestamptz not null default now()
);
-- Un detalle tiene a lo sumo una programación abierta.
create unique index if not exists inspection_schedules_open_uq on public.inspection_schedules (item_id) where outcome = 'programado';
create index if not exists inspection_schedules_day_idx on public.inspection_schedules (scheduled_on, person_id);

alter table public.inspection_schedules enable row level security;
drop policy if exists "inspection_schedules_all" on public.inspection_schedules;
create policy "inspection_schedules_all" on public.inspection_schedules for all to authenticated
  using (private.has_module('inspecciones')) with check (private.has_module('inspecciones'));
grant select, insert, update, delete on public.inspection_schedules to authenticated;

-- Quién puede atender detalles: empleados activos y contratistas activos (pintores y ebanistas).
create or replace function public.inspection_people()
returns table (kind text, id uuid, name text, role text)
language sql stable security definer set search_path = ''
as $$
  select 'contratista', c.id, c.name, c.contractor_type
    from public.contractors c
   where private.has_module('inspecciones') and c.status = 'ACTIVE'
  union all
  select 'empleado', e.id, e.name, coalesce(e.categoria, 'taller')
    from public.payroll_employees e
   where private.has_module('inspecciones') and e.status = 'ACTIVE'
  order by 1, 3;
$$;
revoke all on function public.inspection_people() from public, anon;
grant execute on function public.inspection_people() to authenticated;

-- Programar (o reprogramar) uno o varios detalles a una persona y un día; van al final de su lista de ese día.
create or replace function public.schedule_inspection_items(
  p_item_ids uuid[], p_person_kind text, p_person_id uuid, p_date date, p_note text default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_by text;
  v_next integer;
  v_item uuid;
  v_count integer := 0;
begin
  if not private.has_module('inspecciones') then raise exception 'SIN_PERMISO'; end if;
  if p_person_kind = 'contratista' then
    select name into v_name from public.contractors where id = p_person_id;
  elsif p_person_kind = 'empleado' then
    select name into v_name from public.payroll_employees where id = p_person_id;
  end if;
  if v_name is null then raise exception 'PERSONA_NO_EXISTE'; end if;
  select coalesce(nullif(full_name, ''), email) into v_by from public.profiles where id = auth.uid();
  select coalesce(max(sort_order), 0) into v_next
    from public.inspection_schedules
   where person_id = p_person_id and scheduled_on = p_date and outcome = 'programado';

  foreach v_item in array p_item_ids loop
    -- La programación abierta anterior (si había) queda como reprogramada.
    update public.inspection_schedules
       set outcome = 'reprogramado', closed_at = now()
     where item_id = v_item and outcome = 'programado';
    v_next := v_next + 1;
    insert into public.inspection_schedules (item_id, person_kind, person_id, person_name, scheduled_on, sort_order, note, created_by_name)
    values (v_item, p_person_kind, p_person_id, v_name, p_date, v_next, nullif(btrim(coalesce(p_note, '')), ''), v_by);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.schedule_inspection_items(uuid[], text, uuid, date, text) from public, anon;
grant execute on function public.schedule_inspection_items(uuid[], text, uuid, date, text) to authenticated;

-- Resuelto → su programación abierta queda "hecho" (con la fecha en que se resolvió).
create or replace function private.inspection_item_resolves_schedule()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'resuelto' and old.status is distinct from 'resuelto' then
    update public.inspection_schedules
       set outcome = 'hecho', closed_at = coalesce(new.resolved_at, now())
     where item_id = new.id and outcome = 'programado';
  end if;
  return null;
end;
$$;
drop trigger if exists inspection_item_resolves_schedule on public.inspection_items;
create trigger inspection_item_resolves_schedule after update of status on public.inspection_items
  for each row execute function private.inspection_item_resolves_schedule();
