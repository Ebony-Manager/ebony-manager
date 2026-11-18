-- Taller · Etapa 2: muestras de pintura (reemplaza el formulario de Jotform «Solicitud Muestra Pintura»).
-- Ver TALLER-PLAN.md. Decisiones de Carlos (18 nov):
--  * Una solicitud = un trabajo de tipo `muestra` con varias muestras: nombre, tipo (Sherwin Williams, Benjamin Moore,
--    Chapilla u Otro), tipo de chapilla si aplica, fotos de referencia.
--  * La hace uno de los pintores por turnos (Wilfredo → Osnaider; le toca a Wilfredo). Los pintores son contratistas.
--  * Quiénes entran al turno se activa/desactiva aparte (ej. Elkin sigue activo en Contratistas pero no hace muestras).
--  * Para marcarla lista: foto de cada muestra terminada y, si es Sherwin Williams o Benjamin Moore, su código oficial.

-- 1. Tipo nuevo y responsable contratista.
alter table public.work_orders drop constraint if exists work_orders_kind_check;
alter table public.work_orders add constraint work_orders_kind_check check (kind in ('cnc', 'muestra'));
alter table public.work_orders add column if not exists assignee_contractor_id uuid references public.contractors(id) on delete set null;
create index if not exists work_orders_assignee_contractor_idx on public.work_orders (assignee_contractor_id);

-- 2. Tipos de chapilla (lista que se puede ampliar desde la app).
create table if not exists public.veneer_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(btrim(name)) > 0),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
insert into public.veneer_types (name, sort_order) values ('Roble claro', 1), ('Roble rojo', 2) on conflict (name) do nothing;

-- 3. Las muestras de cada solicitud.
create table if not exists public.paint_samples (
  id              uuid primary key default gen_random_uuid(),
  work_order_id   uuid not null references public.work_orders(id) on delete cascade,
  sort_order      integer not null default 0,
  name            text not null check (length(btrim(name)) > 0),
  kind            text not null check (kind in ('sherwin_williams', 'benjamin_moore', 'chapilla', 'otro')),
  veneer_type_id  uuid references public.veneer_types(id) on delete set null,
  official_code   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists paint_samples_order_idx on public.paint_samples (work_order_id, sort_order);

-- 4. Fotos y archivos ligados a una muestra: de referencia (al pedirla) o del resultado (al terminarla).
alter table public.work_order_files add column if not exists sample_id uuid references public.paint_samples(id) on delete cascade;
alter table public.work_order_files add column if not exists role text not null default 'archivo';
alter table public.work_order_files drop constraint if exists work_order_files_role_check;
alter table public.work_order_files add constraint work_order_files_role_check check (role in ('archivo', 'referencia', 'resultado'));

-- 5. Pintores del turno de muestras (le toca el que lleva más tiempo sin recibir una; en empate, el orden).
create table if not exists public.sample_painters (
  contractor_id  uuid primary key references public.contractors(id) on delete cascade,
  sort_order     integer not null default 0,
  active         boolean not null default true,
  last_turn_at   timestamptz
);
insert into public.sample_painters (contractor_id, sort_order, last_turn_at) values
  ('f9931882-0e05-4382-bd7e-5de92c040661', 1, '2026-11-01 12:00:00+00'),  -- Wilfredo Mendoza (le toca)
  ('04d2a5bd-6f1e-4a18-ac92-6b6ed52b64e1', 2, now())                       -- Osnaider Cantillo
on conflict (contractor_id) do nothing;

-- 6. Permisos: todo el que tiene Taller.
alter table public.veneer_types enable row level security;
alter table public.paint_samples enable row level security;
alter table public.sample_painters enable row level security;
drop policy if exists "veneer_types_taller" on public.veneer_types;
create policy "veneer_types_taller" on public.veneer_types for all to authenticated
  using (private.has_module('taller')) with check (private.has_module('taller'));
drop policy if exists "paint_samples_taller" on public.paint_samples;
create policy "paint_samples_taller" on public.paint_samples for all to authenticated
  using (private.has_module('taller')) with check (private.has_module('taller'));
drop policy if exists "sample_painters_taller" on public.sample_painters;
create policy "sample_painters_taller" on public.sample_painters for all to authenticated
  using (private.has_module('taller')) with check (private.has_module('taller'));
grant select, insert, update, delete on public.veneer_types, public.paint_samples, public.sample_painters to authenticated;

-- 7. Los pintores (contratistas pintores activos, o los que están en el turno) con su lugar en el turno.
--    Sin abrir Contratistas (que trae saldos): solo nombre, foto y si tiene correo.
create or replace function public.taller_painters()
returns table (contractor_id uuid, name text, photo_path text, has_email boolean, in_turn boolean, turn_rank integer)
language sql stable security definer set search_path = ''
as $$
  with turn as (
    select s.contractor_id, row_number() over (order by s.last_turn_at asc nulls first, s.sort_order)::int as rank
      from public.sample_painters s
      join public.contractors c on c.id = s.contractor_id and c.status = 'ACTIVE'
     where s.active
  )
  select c.id, c.name, c.photo_path, coalesce(btrim(c.email), '') <> '', t.contractor_id is not null, t.rank
    from public.contractors c
    left join turn t on t.contractor_id = c.id
   where private.has_module('taller')
     and c.status = 'ACTIVE'
     and (c.contractor_type = 'pintor' or exists (select 1 from public.sample_painters s where s.contractor_id = c.id))
   order by t.rank nulls last, c.name
$$;
revoke all on function public.taller_painters() from public, anon;
grant execute on function public.taller_painters() to authenticated;

-- Correo del pintor y de quien pidió (para avisarles); solo para quien tiene Taller.
create or replace function public.taller_contact_emails(p_contractor uuid, p_user uuid)
returns table (contractor_email text, contractor_name text, user_email text, user_name text)
language sql stable security definer set search_path = ''
as $$
  select nullif(btrim(c.email), ''), c.name, p.email, coalesce(nullif(btrim(p.full_name), ''), p.email)
    from (select 1) x
    left join public.contractors c on c.id = p_contractor
    left join public.profiles p on p.id = p_user
   where private.has_module('taller')
$$;
revoke all on function public.taller_contact_emails(uuid, uuid) from public, anon;
grant execute on function public.taller_contact_emails(uuid, uuid) to authenticated;

-- 8. Al crear una solicitud de muestra, el pintor asignado usa su turno.
create or replace function private.work_order_sample_turn()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'muestra' and new.assignee_contractor_id is not null then
    update public.sample_painters set last_turn_at = now() where contractor_id = new.assignee_contractor_id;
  end if;
  return null;
end; $$;
drop trigger if exists work_orders_sample_turn on public.work_orders;
create trigger work_orders_sample_turn after insert on public.work_orders
  for each row execute function private.work_order_sample_turn();

-- 9. Regla para marcarla lista: cada muestra con su foto terminada y, si es de paleta, su código oficial.
create or replace function private.work_order_sample_ready()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'muestra' and new.status = 'listo' and old.status is distinct from 'listo' then
    if exists (
      select 1 from public.paint_samples s
       where s.work_order_id = new.id
         and (
           not exists (select 1 from public.work_order_files f where f.sample_id = s.id and f.role = 'resultado')
           or (s.kind in ('sherwin_williams', 'benjamin_moore') and coalesce(btrim(s.official_code), '') = '')
         )
    ) then
      raise exception 'Para marcarla lista, cada muestra necesita la foto de la muestra terminada y, si es Sherwin Williams o Benjamin Moore, su código oficial.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists work_orders_sample_ready on public.work_orders;
create trigger work_orders_sample_ready before update on public.work_orders
  for each row execute function private.work_order_sample_ready();

-- 10. Historial: el cambio de pintor también se anota.
create or replace function private.work_order_contractor_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_contractor_id is distinct from old.assignee_contractor_id then
    insert into public.work_order_events (work_order_id, kind, detail)
    values (new.id, 'responsable', (select c.name from public.contractors c where c.id = new.assignee_contractor_id));
  end if;
  return null;
end; $$;
drop trigger if exists work_orders_contractor_event on public.work_orders;
create trigger work_orders_contractor_event after update on public.work_orders
  for each row execute function private.work_order_contractor_event();
