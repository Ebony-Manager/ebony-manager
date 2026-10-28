-- Include the catalog product/variant name in purchase request notifications.
-- Catalog requests leave purchase_requests.description empty; their identity
-- lives on inventory_variants -> inventory_items.
create or replace function private.notify_purchase_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_product_name text;
  v_request_name text;
  v_quantity text;
begin
  select nullif(trim(concat_ws(' · ', i.name, nullif(trim(v.label), ''))), '')
    into v_product_name
    from public.inventory_variants v
    join public.inventory_items i on i.id = v.item_id
   where v.id = new.variant_id;

  v_request_name := coalesce(v_product_name, nullif(trim(new.description), ''), 'Solicitud de compra');
  v_quantity := trim(concat(new.qty, ' ', coalesce(nullif(trim(new.unit), ''), '')));

  insert into public.app_notifications(kind,type_key,title,body,href,actor_id,actor_name)
  values ('purchasing_request','purchasing_request','Nueva solicitud de compra',concat(v_request_name,' · ',v_quantity),
    '/almacen/compras',new.created_by,new.created_by_name);
  if new.supplier_id is null then
    insert into public.app_notifications(kind,type_key,title,body,href,dedupe_key)
    values ('purchasing_no_supplier','purchasing_no_supplier','Solicitud sin proveedor',v_request_name,'/almacen/compras','no_supplier:'||new.id::text);
  end if;
  return null;
end; $$;
