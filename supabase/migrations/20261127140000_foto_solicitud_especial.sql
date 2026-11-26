-- Foto en las solicitudes de compra (sobre todo «Especial para proyecto»: cómo es el herraje o riel que se pidió).
-- Se puede poner o cambiar mientras está pendiente o ya pedida (en camino); al recibirla pasa sola a Apartados.
alter table public.purchase_requests add column if not exists photo_path text;

-- Poner o quitar la foto: quien la pidió o Compras, mientras no se haya recibido.
create or replace function public.set_request_photo(p_id uuid, p_path text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r public.purchase_requests;
begin
  select * into r from public.purchase_requests where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada.'; end if;
  if not (private.has_module('almacen_compras') or r.created_by = auth.uid()) then raise exception 'Sin permiso.'; end if;
  if r.status not in ('pendiente', 'pedido') then raise exception 'Ya se recibió: la foto se cambia en Apartados.'; end if;
  update public.purchase_requests set photo_path = nullif(btrim(p_path), '') where id = p_id;
  return r.photo_path;
end;
$$;
revoke all on function public.set_request_photo(uuid, text) from public, anon;
grant execute on function public.set_request_photo(uuid, text) to authenticated;

-- Fotos de solicitudes: cualquiera que pide puede subirlas (carpeta requests/ del bucket del Almacén).
drop policy if exists "inventory_photos_requests_insert" on storage.objects;
create policy "inventory_photos_requests_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'inventory-photos' and name like 'requests/%');
drop policy if exists "inventory_photos_requests_delete" on storage.objects;
create policy "inventory_photos_requests_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'inventory-photos' and name like 'requests/%' and owner = auth.uid());

-- Al recibirla, la foto pasa al apartado.
create or replace function private.stored_item_from_purchase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.purchase_requests;
begin
  if new.variant_id is not null or new.received_qty <= coalesce(old.received_qty, 0) then return null; end if;
  select * into r from public.purchase_requests where order_line_id = new.id and for_project and project_id is not null limit 1;
  if not found then return null; end if;
  insert into public.project_stored_items (project_id, description, qty, unit, origin, purchase_line_id, supplier_id, notes, photo_path)
  values (r.project_id, coalesce(nullif(btrim(new.description), ''), r.description), new.received_qty, new.unit, 'compra', new.id,
          (select o.supplier_id from public.purchase_orders o where o.id = new.order_id), nullif(btrim(r.reason), ''), r.photo_path)
  on conflict (purchase_line_id) do update set qty = excluded.qty;
  return null;
end;
$$;

-- «Por llegar» con su foto y su link.
drop function if exists public.project_incoming_items(uuid);
create or replace function public.project_incoming_items(p_project uuid default null)
returns table (id uuid, project_id uuid, project_name text, description text, qty numeric, unit text, status text, requested_by text, created_at timestamptz, photo_path text, notes text)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.project_id, p.name, r.description, r.qty, r.unit, r.status, r.created_by_name, r.created_at, r.photo_path, r.reason
    from public.purchase_requests r
    join public.projects p on p.id = r.project_id
   where private.can_stored_items() and r.for_project and r.status in ('pendiente', 'pedido')
     and (p_project is null or r.project_id = p_project)
   order by r.created_at
$$;
revoke all on function public.project_incoming_items(uuid) from public, anon;
grant execute on function public.project_incoming_items(uuid) to authenticated;
