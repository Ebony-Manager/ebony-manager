-- Turno de diseñadoras (decisión de Carlos, 18 nov): al aprobar un proyecto nuevo se SUGIERE la diseñadora a quien
-- le toca; se puede cambiar antes de aprobar. Le toca la del turno que lleva más tiempo sin recibir un proyecto
-- nuevo (en empate, el orden fijo): si siempre se acepta la sugerencia es «una después de la otra», y si se asigna a
-- mano a otra el turno se reacomoda solo. Solo cuentan las aprobaciones que crean proyecto nuevo.
-- Orden: Leslie → Carmen → Patricia. La última fue Patricia (D'Linaire): la próxima es Leslie.

create table if not exists public.designer_rotation (
  employee_id   uuid primary key references public.payroll_employees(id) on delete cascade,
  sort_order    integer not null,
  active        boolean not null default true,
  last_turn_at  timestamptz
);
alter table public.designer_rotation enable row level security;
drop policy if exists "designer_rotation_read" on public.designer_rotation;
create policy "designer_rotation_read" on public.designer_rotation for select to authenticated
  using (private.has_module('proyectos') or private.has_module('contratistas') or private.has_module('cotizacion'));
grant select on public.designer_rotation to authenticated;

insert into public.designer_rotation (employee_id, sort_order, last_turn_at) values
  ('382b4ec5-cd4d-47f5-a1a9-768d9edddd90', 1, '2026-11-01 12:00:00+00'),  -- Leslie Arcia
  ('ba29af8d-4fc1-4cab-b12a-ba0e27c0748d', 2, '2026-11-02 12:00:00+00'),  -- Carmen Mendoza
  ('ab4255bc-1f5c-4514-9c00-e57d65fa86a6', 3, now())                       -- Patricia Fuentes (D'Linaire)
on conflict (employee_id) do nothing;

-- La lista para escoger diseñadoras, ahora con su lugar en el turno (1 = le toca; null = no está en el turno).
drop function if exists public.designer_candidates();
create function public.designer_candidates()
returns table (id uuid, name text, "position" text, has_access boolean, turn_rank integer)
language sql stable security definer set search_path = ''
as $$
  with turn as (
    select r.employee_id, row_number() over (order by r.last_turn_at asc nulls first, r.sort_order)::int as rank
      from public.designer_rotation r
      join public.payroll_employees e on e.id = r.employee_id and e.status = 'ACTIVE'
     where r.active
  )
  select e.id, e.name, e.position, exists (select 1 from public.allowed_emails a where a.employee_id = e.id), t.rank
    from public.payroll_employees e
    left join turn t on t.employee_id = e.id
   where e.status = 'ACTIVE'
     and (private.has_module('proyectos') or private.has_module('contratistas') or private.has_module('cotizacion'))
   order by (e.position ilike '%diseñ%') desc, e.name
$$;
revoke all on function public.designer_candidates() from public, anon;
grant execute on function public.designer_candidates() to authenticated;

-- Se llama al aprobar con proyecto nuevo: las diseñadoras asignadas «gastan» su turno.
create or replace function public.designer_turns_taken(p_employee_ids uuid[])
returns void
language sql security definer set search_path = ''
as $$
  update public.designer_rotation set last_turn_at = now()
   where employee_id = any (p_employee_ids)
     and (private.has_module('cotizacion') or private.has_module('proyectos') or private.has_module('contratistas'))
$$;
revoke all on function public.designer_turns_taken(uuid[]) from public, anon;
grant execute on function public.designer_turns_taken(uuid[]) to authenticated;
