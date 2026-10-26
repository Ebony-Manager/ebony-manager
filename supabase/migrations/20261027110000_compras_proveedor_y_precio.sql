-- Compras: la solicitud puede traer su proveedor (si no, el principal del
-- producto) y en Por pedir quien compra le pone el precio unitario. Pasar a
-- pedido exige precio en todas las líneas: el costo de la línea del pedido
-- nace de ahí (y se puede corregir con la factura).
--
-- El precio va en una tabla aparte (como purchase_order_line_costs) porque
-- las solicitudes las ve también el Almacén, que no ve dinero.

alter table public.purchase_requests
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;

create table if not exists public.purchase_request_costs (
  request_id       uuid          primary key references public.purchase_requests (id) on delete cascade,
  unit_cost_cents  numeric(14,4) not null check (unit_cost_cents >= 0),
  updated_at       timestamptz   not null default now(),
  updated_by       uuid          default auth.uid()
);
comment on table public.purchase_request_costs is 'Precio por unidad base que pone Compras en Por pedir, antes de pasar a pedido.';

alter table public.purchase_request_costs enable row level security;
drop policy if exists "purchase_request_costs_read" on public.purchase_request_costs;
create policy "purchase_request_costs_read" on public.purchase_request_costs for select to authenticated
  using (private.has_module('almacen_compras') or private.has_module('almacen_costos'));
drop policy if exists "purchase_request_costs_write" on public.purchase_request_costs;
create policy "purchase_request_costs_write" on public.purchase_request_costs for all to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));
grant select, insert, update, delete on public.purchase_request_costs to authenticated;

-- Pasar a pedido: igual que antes, pero cada solicitud tiene que tener precio
-- y ese precio queda como costo de su línea (total = precio × cantidad).
create or replace function public.create_purchase_order(
  p_supplier_id uuid,
  p_request_ids uuid[],
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order uuid;
  r public.purchase_requests;
  v_line uuid;
  v_cost numeric;
  v_n integer := 0;
  v_missing text;
begin
  if not private.has_module('almacen_compras') then raise exception 'Sin permiso de Compras.'; end if;
  select string_agg(coalesce(nullif(btrim(q.description), ''), btrim(i.name || ' ' || coalesce(v.label, ''))), ', ') into v_missing
  from public.purchase_requests q
  left join public.inventory_variants v on v.id = q.variant_id
  left join public.inventory_items i on i.id = v.item_id
  where q.id = any (p_request_ids) and q.status = 'pendiente'
    and not exists (select 1 from public.purchase_request_costs c where c.request_id = q.id);
  if v_missing is not null then raise exception 'Falta el precio de: %', v_missing; end if;

  insert into public.purchase_orders (supplier_id, notes) values (p_supplier_id, nullif(btrim(p_notes), '')) returning id into v_order;
  for r in select * from public.purchase_requests where id = any (p_request_ids) and status = 'pendiente' order by created_at loop
    insert into public.purchase_order_lines (order_id, variant_id, description, qty, unit, sort_order)
    values (v_order, r.variant_id, r.description, r.qty, r.unit, v_n)
    returning id into v_line;
    select unit_cost_cents into v_cost from public.purchase_request_costs where request_id = r.id;
    insert into public.purchase_order_line_costs (line_id, total_cents) values (v_line, round(v_cost * r.qty));
    update public.purchase_requests set status = 'pedido', order_line_id = v_line, supplier_id = p_supplier_id where id = r.id;
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'No hay solicitudes pendientes para pedir.'; end if;
  return v_order;
end;
$$;
revoke all on function public.create_purchase_order(uuid, uuid[], text) from public, anon;
grant execute on function public.create_purchase_order(uuid, uuid[], text) to authenticated;
