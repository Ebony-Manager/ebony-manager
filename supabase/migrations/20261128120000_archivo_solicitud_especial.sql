-- Pedido especial por lote: la solicitud lleva un archivo (la cotización o factura del proveedor, PDF o foto) con el
-- detalle, en vez de cargar 30 renglones a mano. Almacén compara contra el archivo al recibir y el apartado lo
-- conserva. Bucket privado (trae precios): lo ven quien trabaja con Apartados o Compras, y quien lo subió.

alter table public.purchase_requests add column if not exists attachment_path text;
alter table public.purchase_requests add column if not exists attachment_name text;
alter table public.project_stored_items add column if not exists attachment_path text;
alter table public.project_stored_items add column if not exists attachment_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('purchase-docs', 'purchase-docs', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "purchase_docs_read" on storage.objects;
create policy "purchase_docs_read" on storage.objects for select to authenticated
  using (bucket_id = 'purchase-docs' and (private.can_stored_items() or private.has_module('almacen_compras') or owner = auth.uid()));
drop policy if exists "purchase_docs_insert" on storage.objects;
create policy "purchase_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'purchase-docs' and name like 'requests/%');
drop policy if exists "purchase_docs_delete" on storage.objects;
create policy "purchase_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'purchase-docs' and (owner = auth.uid() or private.has_module('almacen_compras')));

-- Poner o cambiar el archivo: quien la pidió o Compras, mientras no se haya recibido. Devuelve el anterior.
create or replace function public.set_request_attachment(p_id uuid, p_path text, p_name text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r public.purchase_requests;
begin
  select * into r from public.purchase_requests where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada.'; end if;
  if not (private.has_module('almacen_compras') or r.created_by = auth.uid()) then raise exception 'Sin permiso.'; end if;
  if r.status not in ('pendiente', 'pedido') then raise exception 'Ya se recibió.'; end if;
  update public.purchase_requests
     set attachment_path = nullif(btrim(p_path), ''), attachment_name = nullif(btrim(p_name), '')
   where id = p_id;
  return r.attachment_path;
end;
$$;
revoke all on function public.set_request_attachment(uuid, text, text) from public, anon;
grant execute on function public.set_request_attachment(uuid, text, text) to authenticated;

-- Al recibir, el archivo pasa al apartado (como la foto).
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
  insert into public.project_stored_items (project_id, description, qty, unit, origin, purchase_line_id, supplier_id, notes, photo_path, attachment_path, attachment_name)
  values (r.project_id, coalesce(nullif(btrim(new.description), ''), r.description), new.received_qty, new.unit, 'compra', new.id,
          (select o.supplier_id from public.purchase_orders o where o.id = new.order_id), nullif(btrim(r.reason), ''), r.photo_path,
          r.attachment_path, r.attachment_name)
  on conflict (purchase_line_id) do update set qty = excluded.qty;
  return null;
end;
$$;

-- Lecturas con el archivo.
drop function if exists public.purchase_line_destinations();
create or replace function public.purchase_line_destinations()
returns table (line_id uuid, for_project boolean, project_id uuid, project_name text, photo_path text, notes text, requested_by text,
               attachment_path text, attachment_name text)
language sql stable security definer set search_path = ''
as $$
  select r.order_line_id, r.for_project, r.project_id, p.name, r.photo_path, nullif(btrim(r.reason), ''), r.created_by_name,
         r.attachment_path, r.attachment_name
    from public.purchase_requests r
    join public.purchase_order_lines l on l.id = r.order_line_id
    join public.purchase_orders o on o.id = l.order_id
    left join public.projects p on p.id = r.project_id
   where private.has_module('almacen')
     and o.ordered_on >= private.panama_today() - 180
$$;
revoke all on function public.purchase_line_destinations() from public, anon;
grant execute on function public.purchase_line_destinations() to authenticated;

drop function if exists public.project_incoming_items(uuid);
create or replace function public.project_incoming_items(p_project uuid default null)
returns table (id uuid, project_id uuid, project_name text, description text, qty numeric, unit text, status text, requested_by text,
               created_at timestamptz, photo_path text, notes text, attachment_path text, attachment_name text)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.project_id, p.name, r.description, r.qty, r.unit, r.status, r.created_by_name, r.created_at, r.photo_path, r.reason,
         r.attachment_path, r.attachment_name
    from public.purchase_requests r
    join public.projects p on p.id = r.project_id
   where private.can_stored_items() and r.for_project and r.status in ('pendiente', 'pedido')
     and (p_project is null or r.project_id = p_project)
   order by r.created_at
$$;
revoke all on function public.project_incoming_items(uuid) from public, anon;
grant execute on function public.project_incoming_items(uuid) to authenticated;

drop function if exists public.project_stored_items_list(uuid);
create or replace function public.project_stored_items_list(p_project uuid default null)
returns table (
  id uuid, project_id uuid, project_name text, project_item_id uuid, project_item_name text,
  description text, qty numeric, unit text, origin text, supplier_id uuid, supplier_name text,
  location text, photo_path text, notes text, received_on date, received_by_name text,
  status text, delivered_on date, delivered_to_name text, delivered_by_name text, delivery_notes text,
  total_cents bigint, created_at timestamptz, attachment_path text, attachment_name text
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.project_id, p.name, s.project_item_id, nullif(concat_ws(' · ', nullif(btrim(pi.area), ''), pi.name), ''),
         s.description, s.qty, s.unit, s.origin, s.supplier_id, sp.name,
         s.location, s.photo_path, s.notes, s.received_on, s.received_by_name,
         s.status, s.delivered_on, s.delivered_to_name, s.delivered_by_name, s.delivery_notes,
         case when private.can_stored_costs() then coalesce(c.total_cents, lc.total_cents) end,
         s.created_at, s.attachment_path, s.attachment_name
    from public.project_stored_items s
    join public.projects p on p.id = s.project_id
    left join public.project_items pi on pi.id = s.project_item_id
    left join public.suppliers sp on sp.id = s.supplier_id
    left join public.project_stored_item_costs c on c.item_id = s.id
    left join public.purchase_order_line_costs lc on lc.line_id = s.purchase_line_id
   where private.can_stored_items() and (p_project is null or s.project_id = p_project)
   order by s.status, s.received_on desc, s.created_at desc
$$;
revoke all on function public.project_stored_items_list(uuid) from public, anon;
grant execute on function public.project_stored_items_list(uuid) to authenticated;
