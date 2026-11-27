-- El link o las notas de una solicitud se pueden cambiar también ya pedida (en camino), como la foto: quien la
-- pidió o Compras. Lo demás (qué es, cantidad, proveedor) ya está en el pedido y no se toca desde aquí.
create or replace function public.set_request_notes(p_id uuid, p_notes text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.purchase_requests;
begin
  select * into r from public.purchase_requests where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada.'; end if;
  if not (private.has_module('almacen_compras') or r.created_by = auth.uid()) then raise exception 'Sin permiso.'; end if;
  if r.status not in ('pendiente', 'pedido') then raise exception 'Ya se recibió.'; end if;
  update public.purchase_requests set reason = nullif(btrim(p_notes), '') where id = p_id;
end;
$$;
revoke all on function public.set_request_notes(uuid, text) from public, anon;
grant execute on function public.set_request_notes(uuid, text) to authenticated;
