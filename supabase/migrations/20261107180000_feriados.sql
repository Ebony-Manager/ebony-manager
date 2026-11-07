-- Settings → Feriados: los días feriados de Panamá (y los que dé la empresa).
-- En asistencia, un feriado sin marcaciones no es falta; si alguien marca,
-- el día queda marcado "Trabajó en feriado" para que el admin lo revise (la
-- app no calcula sola el recargo). Todos leen; solo el admin escribe.

create table if not exists public.holidays (
  date        date primary key,
  name        text not null check (btrim(name) <> ''),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.holidays enable row level security;
drop policy if exists "holidays_read" on public.holidays;
create policy "holidays_read" on public.holidays for select to authenticated using (true);
drop policy if exists "holidays_admin_write" on public.holidays;
create policy "holidays_admin_write" on public.holidays for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Feriados nacionales 2026 y 2027 (Carnaval y Viernes Santo según la Pascua).
insert into public.holidays (date, name) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-09', 'Día de los Mártires'),
  ('2026-02-16', 'Carnaval'),
  ('2026-02-17', 'Carnaval'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-11-03', 'Separación de Panamá de Colombia'),
  ('2026-11-05', 'Día de Colón'),
  ('2026-11-10', 'Primer Grito de Independencia'),
  ('2026-11-28', 'Independencia de Panamá de España'),
  ('2026-12-08', 'Día de las Madres'),
  ('2026-12-20', 'Día de Duelo Nacional'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'),
  ('2027-01-09', 'Día de los Mártires'),
  ('2027-02-08', 'Carnaval'),
  ('2027-02-09', 'Carnaval'),
  ('2027-03-26', 'Viernes Santo'),
  ('2027-05-01', 'Día del Trabajo'),
  ('2027-11-03', 'Separación de Panamá de Colombia'),
  ('2027-11-05', 'Día de Colón'),
  ('2027-11-10', 'Primer Grito de Independencia'),
  ('2027-11-28', 'Independencia de Panamá de España'),
  ('2027-12-08', 'Día de las Madres'),
  ('2027-12-20', 'Día de Duelo Nacional'),
  ('2027-12-25', 'Navidad')
on conflict (date) do nothing;
