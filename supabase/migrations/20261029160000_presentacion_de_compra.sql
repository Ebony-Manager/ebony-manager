-- Presentación de compra: lo que se le compra al proveedor no siempre es lo
-- que sale del almacén. La lija viene en rollo de 500 cm y se corta en 28
-- pedazos; el aguarrás y el thinner vienen en galón y se pasan a botellas de
-- 12 oz. La existencia, las salidas y los mínimos siguen en la unidad del
-- almacén; Compras pide, pone precio y recibe por presentación.
--
-- La presentación puede ir en la variante (la "Botella 12 oz" se compra por
-- galón, pero el "Galón" no) o, como ya existía, en el proveedor del
-- producto (rollo de cinta LED de 100 m). Manda la de la variante.

alter table public.inventory_variants
  add column if not exists pack_label text,
  add column if not exists pack_qty numeric check (pack_qty is null or pack_qty > 0);
comment on column public.inventory_variants.pack_qty is 'Unidades del almacén por presentación de compra (rollo de lija → 28 pedazos). Manda sobre la del proveedor.';

-- Unidades por presentación para una variante y un proveedor (o el principal); 1 = se compra suelto.
create or replace function private.inventory_pack_qty(p_variant uuid, p_supplier uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select v.pack_qty from public.inventory_variants v where v.id = p_variant and v.pack_qty > 1),
    (select s.pack_qty from public.inventory_variants v
       join public.inventory_item_suppliers s on s.item_id = v.item_id
      where v.id = p_variant and s.pack_qty > 1
        and (s.supplier_id = p_supplier or (p_supplier is null and s.is_primary))
      limit 1),
    1);
$$;
revoke all on function private.inventory_pack_qty(uuid, uuid) from public, anon, authenticated;

-- Las automáticas se redondean hacia arriba a presentaciones completas
-- (faltan 30 pedazos de lija → 2 rollos = 56).
create or replace function private.inventory_sync_reorder(p_variant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.inventory_variants;
  v_item public.inventory_items;
  v_req public.purchase_requests;
  v_needed boolean;
  v_need numeric;
  v_pack numeric;
  v_qty numeric;
begin
  select * into v from public.inventory_variants where id = p_variant;
  if not found then return; end if;
  select * into v_item from public.inventory_items where id = v.item_id;
  v_needed := v.min_qty is not null and v.min_qty > 0 and v.stock_qty <= v.min_qty and v.active and v_item.active;

  select * into v_req from public.purchase_requests
   where variant_id = v.id and auto and status = 'pendiente'
   order by created_at limit 1;

  v_need := greatest(coalesce(v.reorder_qty, v.min_qty * 2) - greatest(v.stock_qty, 0), case when v_item.allows_decimals then 0.01 else 1 end);
  v_pack := private.inventory_pack_qty(v.id, v_req.supplier_id);
  v_qty := case when v_pack > 1 then ceil(v_need / v_pack) * v_pack else v_need end;

  if v_req.id is not null then
    if v_needed then
      update public.purchase_requests set qty = v_qty where id = v_req.id and qty is distinct from v_qty;
    else
      update public.purchase_requests set status = 'cancelado' where id = v_req.id;
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

-- Cambiar la presentación de una variante también recalcula su automática.
drop trigger if exists inventory_variants_levels on public.inventory_variants;
create trigger inventory_variants_levels
  after update of min_qty, reorder_qty, active, pack_qty on public.inventory_variants
  for each row execute function private.inventory_levels_changed();

-- Lija: rollo de 500 cm = 28 pedazos (en su proveedor, vale para las tres lijas).
update public.inventory_item_suppliers s
   set pack_label = 'Rollo de 500 cm', pack_qty = 28
  from public.inventory_items i
 where i.id = s.item_id and i.name = 'Lija';

-- Aguarrás y thinner: la botella de 12 oz se compra por galón (128 oz → 10 botellas llenas).
update public.inventory_variants v
   set pack_label = 'Galón', pack_qty = 10
  from public.inventory_items i
 where i.id = v.item_id and i.name in ('Aguarrás', 'Thinner') and v.label = 'Botella 12 oz';

-- Poner al día las automáticas pendientes con la presentación.
select private.inventory_sync_reorder(r.variant_id)
  from public.purchase_requests r
 where r.auto and r.status = 'pendiente' and r.variant_id is not null;
