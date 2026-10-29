-- Solicitudes automáticas al día: mientras sigan Pendientes, su cantidad es
-- siempre "pedir hasta" − existencia actual (antes se calculaba una sola vez
-- al crearla y quedaba vieja con cada salida). Si la existencia vuelve a
-- quedar sobre el mínimo (un conteo, una devolución), la solicitud se cancela
-- sola. Las manuales y las que ya están en Pedido no se tocan.
--
-- Se recalcula con cada movimiento y cuando cambian el mínimo o "pedir hasta".

create or replace function private.inventory_sync_reorder(p_variant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.inventory_variants;
  v_item public.inventory_items;
  v_req uuid;
  v_needed boolean;
  v_qty numeric;
begin
  select * into v from public.inventory_variants where id = p_variant;
  if not found then return; end if;
  select * into v_item from public.inventory_items where id = v.item_id;
  v_needed := v.min_qty is not null and v.min_qty > 0 and v.stock_qty <= v.min_qty and v.active and v_item.active;
  v_qty := greatest(coalesce(v.reorder_qty, v.min_qty * 2) - greatest(v.stock_qty, 0), case when v_item.allows_decimals then 0.01 else 1 end);

  select id into v_req from public.purchase_requests
   where variant_id = v.id and auto and status = 'pendiente'
   order by created_at limit 1;

  if v_req is not null then
    if v_needed then
      update public.purchase_requests set qty = v_qty where id = v_req and qty is distinct from v_qty;
    else
      update public.purchase_requests set status = 'cancelado' where id = v_req;
    end if;
    return;
  end if;

  if not v_needed then return; end if;
  if exists (select 1 from public.purchase_requests r where r.variant_id = v.id and r.status in ('pendiente', 'pedido')) then return; end if;
  insert into public.purchase_requests (variant_id, qty, unit, reason, auto, created_by, created_by_name)
  values (v.id, v_qty, v_item.unit, 'Llegó al mínimo', true, null, 'Automática');
end;
$$;
revoke all on function private.inventory_sync_reorder(uuid) from public, anon, authenticated;

create or replace function private.inventory_check_reorder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.inventory_sync_reorder(new.variant_id);
  return null;
end;
$$;

create or replace function private.inventory_levels_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.inventory_sync_reorder(new.id);
  return null;
end;
$$;
drop trigger if exists inventory_variants_levels on public.inventory_variants;
create trigger inventory_variants_levels
  after update of min_qty, reorder_qty, active on public.inventory_variants
  for each row execute function private.inventory_levels_changed();

-- Poner al día las automáticas pendientes que todavía hacen falta (las que
-- ya quedaron sobre el mínimo se dejan como están hasta su próximo movimiento).
update public.purchase_requests r
   set qty = greatest(coalesce(v.reorder_qty, v.min_qty * 2) - greatest(v.stock_qty, 0), case when i.allows_decimals then 0.01 else 1 end)
  from public.inventory_variants v
  join public.inventory_items i on i.id = v.item_id
 where r.variant_id = v.id and r.auto and r.status = 'pendiente'
   and v.min_qty > 0 and v.stock_qty <= v.min_qty
   and r.qty is distinct from greatest(coalesce(v.reorder_qty, v.min_qty * 2) - greatest(v.stock_qty, 0), case when i.allows_decimals then 0.01 else 1 end);
