-- Compras puede corregir el último costo directamente desde la ficha del producto.
-- Sigue oculto para usuarios sin Compras ni Costos del almacén.
drop policy if exists "inventory_costs_write" on public.inventory_costs;
create policy "inventory_costs_write" on public.inventory_costs for all to authenticated
  using (private.has_module('almacen_compras'))
  with check (private.has_module('almacen_compras'));

grant insert, update, delete on public.inventory_costs to authenticated;
