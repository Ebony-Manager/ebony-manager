-- Settings → Notificaciones: cada aviso automático de la app (hoy, el
-- resumen diario del Almacén) se prende o apaga, se eligen los días y quién
-- lo recibe, sin tocar código. El cron de Vercel corre todos los días y la
-- ruta consulta esta tabla antes de mandar. Solo admin.

create table if not exists public.notification_settings (
  key              text        primary key,
  enabled          boolean     not null default false,
  -- Días ISO: 1 = lunes … 7 = domingo.
  days             integer[]   not null default '{1,2,3,4,5,6}',
  -- Correos a los que llega; null = automático (admins y quien tiene Compras).
  recipients       text[],
  updated_at       timestamptz not null default now(),
  updated_by_name  text
);

alter table public.notification_settings enable row level security;
create policy "notification_settings_admin" on public.notification_settings for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
revoke all on public.notification_settings from anon;
grant select, insert, update on public.notification_settings to authenticated;

create or replace trigger notification_settings_touch_updated_at before update on public.notification_settings
  for each row execute function private.touch_updated_at();

-- Arranca apagado: se prende cuando se empiece a usar el inventario.
insert into public.notification_settings (key, enabled) values ('almacen_resumen', false) on conflict (key) do nothing;

-- El resumen ahora devuelve si está prendido, los días y los destinatarios elegidos.
create or replace function public.inventory_daily_summary(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.panama_today();
  s public.notification_settings;
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'almacen_resumen' and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;
  select * into s from public.notification_settings where key = 'almacen_resumen';

  return jsonb_build_object(
    'today', v_today,
    'dow', extract(isodow from v_today)::int,
    'enabled', coalesce(s.enabled, false),
    'days', to_jsonb(coalesce(s.days, '{1,2,3,4,5,6}'::integer[])),
    'recipients', case
      when s.recipients is not null then to_jsonb(s.recipients)
      else (select coalesce(jsonb_agg(distinct p.email), '[]') from public.profiles p
             where p.email <> '' and (p.role = 'admin' or 'almacen_compras' = any (p.modules)))
    end,
    'low_stock', (select coalesce(jsonb_agg(x order by x->>'category', x->>'name'), '[]') from (
        select jsonb_build_object('category', coalesce(c.name, ''), 'name', i.name, 'label', v.label, 'unit', i.unit,
                                  'stock', v.stock_qty, 'min', v.min_qty, 'reorder', v.reorder_qty,
                                  'requested', exists (select 1 from public.purchase_requests r where r.variant_id = v.id and r.status in ('pendiente', 'pedido'))) x
          from public.inventory_variants v
          join public.inventory_items i on i.id = v.item_id
          left join public.inventory_categories c on c.id = i.category_id
         where v.active and i.active and v.min_qty is not null and v.min_qty > 0 and v.stock_qty <= v.min_qty) q),
    'pending_requests', (select coalesce(jsonb_agg(x order by x->>'created_at'), '[]') from (
        select jsonb_build_object('name', coalesce(nullif(trim(i.name || ' ' || coalesce(nullif(v.label, ''), '')), ''), r.description),
                                  'label', v.label, 'qty', r.qty, 'unit', r.unit, 'by', r.created_by_name, 'auto', r.auto,
                                  'created_at', r.created_at) x
          from public.purchase_requests r
          left join public.inventory_variants v on v.id = r.variant_id
          left join public.inventory_items i on i.id = v.item_id
         where r.status = 'pendiente') q),
    'open_orders', (select coalesce(jsonb_agg(x order by x->>'ordered_on'), '[]') from (
        select jsonb_build_object('supplier', su.name, 'ordered_on', o.ordered_on, 'status', o.status,
                                  'days', v_today - o.ordered_on,
                                  'lines', (select count(*) from public.purchase_order_lines l where l.order_id = o.id and l.received_qty < l.qty)) x
          from public.purchase_orders o join public.suppliers su on su.id = o.supplier_id
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
