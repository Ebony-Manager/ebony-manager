-- Diseño: cada ítem tiene su diseñadora (una), escogida entre las del proyecto. Si el proyecto tiene una sola,
-- el ítem nuevo se le asigna solo; con varias queda «sin asignar» hasta que alguien lo reparta.

alter table public.project_items
  add column if not exists designer_id uuid references public.payroll_employees(id) on delete set null;
create index if not exists project_items_designer_idx on public.project_items (designer_id);
comment on column public.project_items.designer_id is 'La diseñadora del ítem (una de las del proyecto); null = sin asignar.';

-- Al crear: si no viene diseñadora y el proyecto tiene una sola, es esa.
create or replace function private.project_item_default_designer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.designer_id is null then
    select min(d.employee_id::text)::uuid into new.designer_id
      from public.project_designers d
     where d.project_id = new.project_id
    having count(*) = 1;
  end if;
  return new;
end; $$;
drop trigger if exists project_items_default_designer on public.project_items;
create trigger project_items_default_designer before insert on public.project_items
  for each row execute function private.project_item_default_designer();

-- El historial anota el cambio de diseñadora.
create or replace function private.project_item_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.project_item_events (item_id, kind, to_stage) values (new.id, 'creado', new.stage);
  else
    if new.stage is distinct from old.stage then
      insert into public.project_item_events (item_id, kind, from_stage, to_stage) values (new.id, 'etapa', old.stage, new.stage);
    end if;
    if new.designer_id is distinct from old.designer_id then
      insert into public.project_item_events (item_id, kind, detail)
      values (new.id, 'editado', 'Diseñadora: ' || coalesce((select e.name from public.payroll_employees e where e.id = new.designer_id), 'sin asignar'));
    end if;
  end if;
  return null;
end; $$;

-- Las diseñadoras de cada proyecto, con id y nombre (para asignar y mostrar en el tablero; sin abrir Personal).
create or replace function public.project_designer_options()
returns table (project_id uuid, employee_id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select d.project_id, d.employee_id, e.name
    from public.project_designers d
    join public.payroll_employees e on e.id = d.employee_id
   where private.has_module('proyectos') or private.has_module('contratistas') or private.has_module('diseno')
   order by e.name
$$;
revoke all on function public.project_designer_options() from public, anon;
grant execute on function public.project_designer_options() to authenticated;

-- Quién soy en Personal (para «Mis ítems» del tablero).
create or replace function public.my_employee_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select private.my_employee_id() $$;
revoke all on function public.my_employee_id() from public, anon;
grant execute on function public.my_employee_id() to authenticated;

-- Los ítems que ya existen: los de proyectos con una sola diseñadora quedan con ella.
update public.project_items i
   set designer_id = s.employee_id
  from (select project_id, min(employee_id::text)::uuid as employee_id
          from public.project_designers group by project_id having count(*) = 1) s
 where i.project_id = s.project_id and i.designer_id is null;
