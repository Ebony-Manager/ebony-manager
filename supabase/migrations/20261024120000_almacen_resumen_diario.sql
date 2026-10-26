-- Resumen diario del Almacén por correo (Resend). Lo dispara el cron de
-- Vercel sin sesión de usuario: la función pide el token de la integración
-- (mismo esquema que el webhook de JotForm: solo se guarda su hash en
-- private.integration_tokens) y devuelve lo que va en el correo y a quién.
--
-- El token es el CRON_SECRET de Vercel. Para no copiarlo a mano, un admin
-- abre una vez /api/almacen/resumen-diario?activar=1 y la app guarda su hash
-- con set_inventory_summary_token (solo admin).

create or replace function public.set_inventory_summary_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Solo un admin puede activar el resumen.'; end if;
  if coalesce(length(p_token), 0) < 16 then raise exception 'Token muy corto.'; end if;
  insert into private.integration_tokens (name, token_hash)
  values ('almacen_resumen', encode(extensions.digest(p_token, 'sha256'), 'hex'))
  on conflict (name) do update set token_hash = excluded.token_hash, created_at = now();
end;
$$;

create or replace function public.inventory_daily_summary(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.panama_today();
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'almacen_resumen' and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'today', v_today,
    -- A quién: admins y quien tiene Compras.
    'recipients', (select coalesce(jsonb_agg(distinct p.email), '[]') from public.profiles p
                    where p.email <> '' and (p.role = 'admin' or 'almacen_compras' = any (p.modules))),
    'low_stock', (select coalesce(jsonb_agg(x order by x->>'category', x->>'name'), '[]') from (
        select jsonb_build_object('category', coalesce(c.name, ''), 'name', i.name, 'label', v.label, 'unit', i.unit,
                                  'stock', v.stock_qty, 'min', v.min_qty, 'reorder', v.reorder_qty,
                                  'requested', exists (select 1 from public.purchase_requests r where r.variant_id = v.id and r.status in ('pendiente', 'pedido'))) x
          from public.inventory_variants v
          join public.inventory_items i on i.id = v.item_id
          left join public.inventory_categories c on c.id = i.category_id
         where v.active and i.active and v.min_qty is not null and v.min_qty > 0 and v.stock_qty <= v.min_qty) s),
    'pending_requests', (select coalesce(jsonb_agg(x order by x->>'created_at'), '[]') from (
        select jsonb_build_object('name', coalesce(nullif(trim(i.name || ' ' || coalesce(nullif(v.label, ''), '')), ''), r.description),
                                  'label', v.label, 'qty', r.qty, 'unit', r.unit, 'by', r.created_by_name, 'auto', r.auto,
                                  'created_at', r.created_at) x
          from public.purchase_requests r
          left join public.inventory_variants v on v.id = r.variant_id
          left join public.inventory_items i on i.id = v.item_id
         where r.status = 'pendiente') s),
    'open_orders', (select coalesce(jsonb_agg(x order by x->>'ordered_on'), '[]') from (
        select jsonb_build_object('supplier', s.name, 'ordered_on', o.ordered_on, 'status', o.status,
                                  'days', v_today - o.ordered_on,
                                  'lines', (select count(*) from public.purchase_order_lines l where l.order_id = o.id and l.received_qty < l.qty)) x
          from public.purchase_orders o join public.suppliers s on s.id = o.supplier_id
         where o.status in ('pedido', 'parcial')) q),
    'yesterday', (select jsonb_build_object(
        'issues', count(distinct m.issue_id),
        'lines', count(*),
        'short', coalesce(jsonb_agg(distinct (i.name || coalesce(' · ' || nullif(v.label, ''), ''))) filter (where m.stock_after < 0), '[]'))
          from public.inventory_movements m
          join public.inventory_variants v on v.id = m.variant_id
          join public.inventory_items i on i.id = v.item_id
         where m.kind = 'salida' and m.moved_on = v_today - 1)
  );
end;
$$;

revoke all on function public.set_inventory_summary_token(text) from public, anon;
grant execute on function public.set_inventory_summary_token(text) to authenticated;
revoke all on function public.inventory_daily_summary(text) from public;
grant execute on function public.inventory_daily_summary(text) to anon, authenticated;
