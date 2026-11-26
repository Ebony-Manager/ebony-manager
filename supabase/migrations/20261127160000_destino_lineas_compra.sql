-- Para qué es cada línea de un pedido (lo que almacén se pregunta al recibir): especial para un proyecto
-- (va a Apartados), para un proyecto, o para inventario. Almacén no ve las solicitudes de otros (RLS de
-- Compras), así que esto le da solo lo necesario: proyecto, si es especial, foto y notas.
create or replace function public.purchase_line_destinations()
returns table (line_id uuid, for_project boolean, project_id uuid, project_name text, photo_path text, notes text, requested_by text)
language sql stable security definer set search_path = ''
as $$
  select r.order_line_id, r.for_project, r.project_id, p.name, r.photo_path, nullif(btrim(r.reason), ''), r.created_by_name
    from public.purchase_requests r
    join public.purchase_order_lines l on l.id = r.order_line_id
    join public.purchase_orders o on o.id = l.order_id
    left join public.projects p on p.id = r.project_id
   where private.has_module('almacen')
     and o.ordered_on >= private.panama_today() - 180
$$;
revoke all on function public.purchase_line_destinations() from public, anon;
grant execute on function public.purchase_line_destinations() to authenticated;
