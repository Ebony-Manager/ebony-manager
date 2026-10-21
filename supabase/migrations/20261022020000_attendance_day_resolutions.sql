-- Asistencia: días revisados a mano.
--
-- Regla de Ebony: ante la duda, a favor de la empresa. Un día al que le falta
-- la entrada o la salida (o con una marcación dudosa) no se supone: la
-- persona no pasa a la Quincena hasta que alguien revise ese día y anote la
-- hora real. También sirve para un día "sin marcar" en que la persona sí vino,
-- o para confirmar que no vino (sin horas).
--
-- Sin sentencias que borren objetos. Idempotente.

create table if not exists public.attendance_day_resolutions (
  employee_id        uuid not null references public.payroll_employees (id) on delete cascade,
  day                date not null,
  arrival_minutes    integer check (arrival_minutes is null or arrival_minutes between 0 and 1439),
  departure_minutes  integer check (departure_minutes is null or departure_minutes between 0 and 1439),
  note               text,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null,
  primary key (employee_id, day)
);

comment on table public.attendance_day_resolutions is
  'Hora real de entrada/salida anotada al revisar un día en Asistencia; manda sobre las ponchadas de ese día. Sin horas = confirmado que no vino.';

create index if not exists attendance_day_resolutions_day_idx on public.attendance_day_resolutions (day);

alter table public.attendance_day_resolutions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_day_resolutions'
                 and policyname = 'attendance_day_resolutions_select') then
    create policy "attendance_day_resolutions_select" on public.attendance_day_resolutions
      for select to authenticated using (private.has_module('asistencia'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_day_resolutions'
                 and policyname = 'attendance_day_resolutions_insert') then
    create policy "attendance_day_resolutions_insert" on public.attendance_day_resolutions
      for insert to authenticated with check (private.has_module('asistencia'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_day_resolutions'
                 and policyname = 'attendance_day_resolutions_update') then
    create policy "attendance_day_resolutions_update" on public.attendance_day_resolutions
      for update to authenticated using (private.has_module('asistencia')) with check (private.has_module('asistencia'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_day_resolutions'
                 and policyname = 'attendance_day_resolutions_delete') then
    create policy "attendance_day_resolutions_delete" on public.attendance_day_resolutions
      for delete to authenticated using (private.has_module('asistencia'));
  end if;
end;
$$;
