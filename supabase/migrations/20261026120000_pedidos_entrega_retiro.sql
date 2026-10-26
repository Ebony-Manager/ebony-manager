-- Pedidos: ¿lo trae el proveedor o hay que ir a retirarlo? Se elige al
-- marcar «Pedido ✓» y alimentará la agenda de transporte (lo que está "por
-- retirar"). Los pedidos que ya existían quedan como retiro (decisión del
-- dueño, 26-oct-2026).

alter table public.purchase_orders
  add column if not exists delivery text check (delivery in ('entrega', 'retiro'));

update public.purchase_orders set delivery = 'retiro' where delivery is null;
