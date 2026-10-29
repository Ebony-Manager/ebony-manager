-- La presentación de compra queda en un solo lugar: la variante. La que
-- estaba en el proveedor del producto (lija, cinta LED, tapas) pasa a todas
-- sus variantes que no tenían, y se limpia del proveedor para que no haya dos
-- lugares que digan cosas distintas.

update public.inventory_variants v
   set pack_label = s.pack_label, pack_qty = s.pack_qty
  from public.inventory_item_suppliers s
 where s.item_id = v.item_id and s.pack_qty > 1 and v.pack_qty is null
   and s.supplier_id = (
     select s2.supplier_id from public.inventory_item_suppliers s2
      where s2.item_id = v.item_id and s2.pack_qty > 1
      order by s2.is_primary desc limit 1);

update public.inventory_item_suppliers set pack_label = null, pack_qty = null
 where pack_label is not null or pack_qty is not null;

-- Unidades por presentación: solo la de la variante (el proveedor ya no cuenta).
create or replace function private.inventory_pack_qty(p_variant uuid, p_supplier uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select v.pack_qty from public.inventory_variants v where v.id = p_variant and v.pack_qty > 1), 1);
$$;
revoke all on function private.inventory_pack_qty(uuid, uuid) from public, anon, authenticated;
