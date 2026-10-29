-- Proyecto → Suministros: todo lo que salió del almacén para esa obra.
-- Lo ve quien entra a la ficha del proyecto (Proyectos o Contratistas) o el
-- Almacén, aunque no tenga permiso de leer las tablas del almacén. El costo
-- (último costo de cada producto, no el de ese día) solo llega a quien tiene
-- Costos del almacén o Compras; a los demás, null.

create or replace function public.project_supplies(p_project uuid)
returns table (
  movement_id     uuid,
  issued_on       date,
  issue_id        uuid,
  variant_id      uuid,
  item_name       text,
  variant_label   text,
  photo_path      text,
  unit            text,
  qty             numeric,
  recipient       text,
  unit_cost_cents numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, s.issued_on, s.id, v.id, i.name, v.label, i.photo_path, i.unit, -m.qty,
         coalesce(e.name, c.name),
         case when private.has_module('almacen_costos') or private.has_module('almacen_compras') then k.unit_cost_cents end
    from public.inventory_issues s
    join public.inventory_movements m on m.issue_id = s.id
    join public.inventory_variants v on v.id = m.variant_id
    join public.inventory_items i on i.id = v.item_id
    left join public.inventory_costs k on k.variant_id = v.id
    left join public.payroll_employees e on e.id = s.recipient_employee_id
    left join public.contractors c on c.id = s.recipient_contractor_id
   where s.project_id = p_project
     and (private.has_module('proyectos') or private.has_module('contratistas') or private.has_module('almacen'))
   order by s.issued_on desc, s.created_at desc, i.name, v.label;
$$;
revoke all on function public.project_supplies(uuid) from public, anon;
grant execute on function public.project_supplies(uuid) to authenticated;
