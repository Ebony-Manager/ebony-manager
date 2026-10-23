-- Almacén — Etapa 1: proveedores, catálogo (productos + variantes),
-- existencias, salidas, solicitudes de compra, pedidos, recepción, costos y
-- ajustes. Reemplaza al JotForm "Egreso de Suministros" y al tablero de
-- Compras de ClickUp.
--
-- Permisos: `almacen` (padre: ver productos y existencias, registrar salidas
-- y recibir) con tres sub-permisos: `almacen_compras` (solicitudes → pedidos,
-- proveedores, catálogo, costo de facturas), `almacen_costos` (ver costos y
-- valor) y `almacen_ajustes` (conteos y ajustes). Cualquier usuario puede
-- crear una solicitud de compra; solo Compras las gestiona.
--
-- La existencia es la suma de los movimientos: nunca se edita a mano. Cada
-- salida, recepción o ajuste entra por una función que escribe el movimiento
-- y actualiza la existencia en la misma transacción. Una salida sin
-- existencia suficiente se registra igual (queda con existencia negativa
-- para revisar): no se frena la obra por un conteo imperfecto.

-- ============================================================================
-- 1. Permisos
-- ============================================================================
alter table public.allowed_emails drop constraint if exists allowed_emails_modules_check;
alter table public.allowed_emails add constraint allowed_emails_modules_check
  check (modules <@ array['cotizacion', 'costos', 'proyectos', 'planilla', 'asistencia', 'contratistas', 'documentos',
                          'almacen', 'almacen_compras', 'almacen_costos', 'almacen_ajustes']::text[]);

-- Quien registra (salidas, pedidos, ajustes, solicitudes): el usuario
-- conectado, con su nombre guardado tal cual para el historial.
create or replace function private.inventory_stamp_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sin usuario y con nombre puesto = lo creó la base (ej. solicitud "Automática").
  if new.created_by is null and new.created_by_name is not null then return new; end if;
  new.created_by := coalesce((select auth.uid()), new.created_by);
  new.created_by_name := (select coalesce(nullif(p.full_name, ''), p.email) from public.profiles p where p.id = new.created_by);
  return new;
end;
$$;
revoke all on function private.inventory_stamp_author() from public;

create or replace function private.panama_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Panama')::date $$;

-- ============================================================================
-- 2. Proveedores y servicios
-- ============================================================================
create table if not exists public.suppliers (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null check (btrim(name) <> ''),
  kind          text        not null default 'materiales' check (kind in ('materiales', 'servicio')),
  contact_name  text,
  phone         text,
  whatsapp      text,
  email         text,
  address       text,
  notes         text,
  active        boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.suppliers is 'Proveedores de materiales y de servicios (transporte, mantenimiento…). Sin cuentas bancarias.';

-- ============================================================================
-- 3. Catálogo
-- ============================================================================
create table if not exists public.inventory_categories (
  id          uuid    primary key default gen_random_uuid(),
  name        text    not null unique check (btrim(name) <> ''),
  sort_order  integer not null default 0
);

create table if not exists public.inventory_items (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null check (btrim(name) <> ''),
  category_id      uuid        references public.inventory_categories (id) on delete set null,
  unit             text        not null default 'unidad'
                               check (unit in ('unidad', 'metro', 'caja', 'galon', 'botella', 'lamina', 'rollo', 'par', 'juego', 'kilo', 'pliego', 'bolsa')),
  allows_decimals  boolean     not null default false,
  kind             text        not null default 'suministro' check (kind in ('suministro', 'devolvible')),
  photo_path       text,
  notes            text,
  active           boolean     not null default true,
  jotform_pid      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on column public.inventory_items.kind is 'devolvible: High Tack, Celulón, broca de pared… (se devuelve el envase o la pieza dañada).';
comment on column public.inventory_items.jotform_pid is 'ID del producto en el JotForm de Egreso de Suministros, para trazar la migración.';
create index if not exists inventory_items_category_idx on public.inventory_items (category_id);

-- Cada producto tiene al menos una variante ("" = única). Existencia, mínimo
-- y "pedir hasta" son por variante; todo (salidas, compras, conteos) apunta a
-- una variante.
create table if not exists public.inventory_variants (
  id          uuid        primary key default gen_random_uuid(),
  item_id     uuid        not null references public.inventory_items (id) on delete cascade,
  label       text        not null default '',
  stock_qty   numeric     not null default 0,
  min_qty     numeric     check (min_qty is null or min_qty >= 0),
  reorder_qty numeric     check (reorder_qty is null or reorder_qty >= 0),
  sort_order  integer     not null default 0,
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (item_id, label)
);
comment on column public.inventory_variants.reorder_qty is 'Pedir hasta: al llegar al mínimo, la solicitud automática pide esto menos la existencia.';
create index if not exists inventory_variants_item_idx on public.inventory_variants (item_id);

create table if not exists public.inventory_item_suppliers (
  item_id      uuid    not null references public.inventory_items (id) on delete cascade,
  supplier_id  uuid    not null references public.suppliers (id) on delete cascade,
  is_primary   boolean not null default false,
  pack_label   text,
  pack_qty     numeric check (pack_qty is null or pack_qty > 0),
  supplier_ref text,
  notes        text,
  primary key (item_id, supplier_id)
);
comment on column public.inventory_item_suppliers.pack_qty is 'Unidades base por presentación de compra (rollo de 200 m → 200).';
create unique index if not exists inventory_item_suppliers_one_primary on public.inventory_item_suppliers (item_id) where is_primary;
create index if not exists inventory_item_suppliers_supplier_idx on public.inventory_item_suppliers (supplier_id);

-- Último costo por unidad base. Aparte para que solo lo vean Compras y Costos.
create table if not exists public.inventory_costs (
  variant_id        uuid          primary key references public.inventory_variants (id) on delete cascade,
  unit_cost_cents   numeric(14,4) not null check (unit_cost_cents >= 0),
  purchase_line_id  uuid,
  updated_at        timestamptz   not null default now()
);

-- ============================================================================
-- 4. Salidas, ajustes y movimientos
-- ============================================================================
create table if not exists public.inventory_issues (
  id                       uuid        primary key default gen_random_uuid(),
  issued_on                date        not null default private.panama_today(),
  recipient_employee_id    uuid        references public.payroll_employees (id) on delete restrict,
  recipient_contractor_id  uuid        references public.contractors (id) on delete restrict,
  project_id               uuid        references public.projects (id) on delete restrict,
  internal_use             text        check (internal_use in ('taller', 'embalaje', 'pintura')),
  notes                    text,
  created_by               uuid        references public.profiles (id) on delete set null,
  created_by_name          text,
  created_at               timestamptz not null default now(),
  constraint inventory_issues_one_recipient check ((recipient_employee_id is null) <> (recipient_contractor_id is null)),
  constraint inventory_issues_one_destination check ((project_id is null) <> (internal_use is null))
);
create index if not exists inventory_issues_date_idx on public.inventory_issues (issued_on desc);
create index if not exists inventory_issues_project_idx on public.inventory_issues (project_id);
create index if not exists inventory_issues_employee_idx on public.inventory_issues (recipient_employee_id);
create index if not exists inventory_issues_contractor_idx on public.inventory_issues (recipient_contractor_id);

create table if not exists public.inventory_adjustments (
  id               uuid        primary key default gen_random_uuid(),
  adjusted_on      date        not null default private.panama_today(),
  reason           text        not null check (reason in ('inicial', 'conteo', 'dano', 'perdida', 'correccion')),
  notes            text,
  created_by       uuid        references public.profiles (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now()
);

-- ============================================================================
-- 5. Compras
-- ============================================================================
create table if not exists public.purchase_orders (
  id               uuid        primary key default gen_random_uuid(),
  supplier_id      uuid        not null references public.suppliers (id) on delete restrict,
  status           text        not null default 'pedido' check (status in ('pedido', 'parcial', 'recibido', 'cancelado')),
  ordered_on       date        not null default private.panama_today(),
  invoice_ref      text,
  notes            text,
  created_by       uuid        references public.profiles (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier_id, ordered_on desc);

-- Líneas en unidad base del producto (metros, unidades…). Sin costo: el
-- costo va aparte (purchase_order_line_costs) para que quien recibe no lo vea.
create table if not exists public.purchase_order_lines (
  id            uuid    primary key default gen_random_uuid(),
  order_id      uuid    not null references public.purchase_orders (id) on delete cascade,
  variant_id    uuid    references public.inventory_variants (id) on delete restrict,
  description   text    not null default '',
  qty           numeric not null check (qty > 0),
  received_qty  numeric not null default 0 check (received_qty >= 0),
  unit          text,
  sort_order    integer not null default 0,
  constraint purchase_order_lines_what check (variant_id is not null or btrim(description) <> '')
);
create index if not exists purchase_order_lines_order_idx on public.purchase_order_lines (order_id);
create index if not exists purchase_order_lines_variant_idx on public.purchase_order_lines (variant_id);

create table if not exists public.purchase_order_line_costs (
  line_id      uuid        primary key references public.purchase_order_lines (id) on delete cascade,
  total_cents  bigint      not null check (total_cents >= 0),
  updated_at   timestamptz not null default now()
);
comment on table public.purchase_order_line_costs is 'Costo total de la línea según la factura. El costo por unidad = total / cantidad pedida.';

-- Cualquier usuario pide (del catálogo o en texto libre: "escobas"); Compras
-- las agrupa en pedidos. Las automáticas nacen al llegar al mínimo.
create table if not exists public.purchase_requests (
  id               uuid        primary key default gen_random_uuid(),
  variant_id       uuid        references public.inventory_variants (id) on delete restrict,
  description      text        not null default '',
  qty              numeric     not null check (qty > 0),
  unit             text,
  project_id       uuid        references public.projects (id) on delete set null,
  reason           text,
  status           text        not null default 'pendiente' check (status in ('pendiente', 'pedido', 'recibido', 'cancelado')),
  auto             boolean     not null default false,
  order_line_id    uuid        references public.purchase_order_lines (id) on delete set null,
  created_by       uuid        references public.profiles (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint purchase_requests_what check (variant_id is not null or btrim(description) <> '')
);
create index if not exists purchase_requests_status_idx on public.purchase_requests (status, created_at desc);
create index if not exists purchase_requests_variant_idx on public.purchase_requests (variant_id);
create index if not exists purchase_requests_author_idx on public.purchase_requests (created_by);

create table if not exists public.inventory_movements (
  id                uuid        primary key default gen_random_uuid(),
  variant_id        uuid        not null references public.inventory_variants (id) on delete restrict,
  kind              text        not null check (kind in ('salida', 'recepcion', 'ajuste')),
  qty               numeric     not null check (qty <> 0),
  stock_after       numeric     not null default 0,
  moved_on          date        not null default private.panama_today(),
  issue_id          uuid        references public.inventory_issues (id) on delete restrict,
  purchase_line_id  uuid        references public.purchase_order_lines (id) on delete restrict,
  adjustment_id     uuid        references public.inventory_adjustments (id) on delete restrict,
  created_by        uuid        references public.profiles (id) on delete set null,
  created_by_name   text,
  created_at        timestamptz not null default now(),
  constraint inventory_movements_source check (num_nonnulls(issue_id, purchase_line_id, adjustment_id) = 1)
);
create index if not exists inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index if not exists inventory_movements_issue_idx on public.inventory_movements (issue_id);
create index if not exists inventory_movements_line_idx on public.inventory_movements (purchase_line_id);
create index if not exists inventory_movements_adjustment_idx on public.inventory_movements (adjustment_id);

-- ============================================================================
-- 6. Existencia: solo la mueven los movimientos
-- ============================================================================
create or replace function private.inventory_guard_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.stock_qty := 0;
  elsif new.stock_qty is distinct from old.stock_qty and coalesce(current_setting('app.inventory_stock_write', true), '') <> 'on' then
    raise exception 'La existencia solo cambia con salidas, recepciones o ajustes.';
  end if;
  return new;
end;
$$;

create or replace function private.inventory_apply_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock numeric;
begin
  select stock_qty + new.qty into v_stock from public.inventory_variants where id = new.variant_id for update;
  if not found then raise exception 'Variante no encontrada.'; end if;
  perform set_config('app.inventory_stock_write', 'on', true);
  update public.inventory_variants set stock_qty = v_stock where id = new.variant_id;
  perform set_config('app.inventory_stock_write', '', true);
  new.stock_after := v_stock;
  return new;
end;
$$;
revoke all on function private.inventory_apply_movement() from public;

-- Al llegar al mínimo nace una solicitud automática (si no hay una abierta).
create or replace function private.inventory_check_reorder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.inventory_variants;
  v_item public.inventory_items;
begin
  select * into v from public.inventory_variants where id = new.variant_id;
  if v.min_qty is null or v.min_qty <= 0 or v.stock_qty > v.min_qty or not v.active then return null; end if;
  if exists (select 1 from public.purchase_requests r where r.variant_id = v.id and r.status in ('pendiente', 'pedido')) then return null; end if;
  select * into v_item from public.inventory_items where id = v.item_id;
  if not v_item.active then return null; end if;
  insert into public.purchase_requests (variant_id, qty, unit, reason, auto, created_by, created_by_name)
  values (v.id,
          greatest(coalesce(v.reorder_qty, v.min_qty * 2) - greatest(v.stock_qty, 0), case when v_item.allows_decimals then 0.01 else 1 end),
          v_item.unit, 'Llegó al mínimo', true, null, 'Automática');
  return null;
end;
$$;
revoke all on function private.inventory_check_reorder() from public;

-- ============================================================================
-- 7. Costos
-- ============================================================================
create or replace function private.inventory_apply_line_cost(p_line uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.purchase_order_lines;
  v_total bigint;
begin
  select * into l from public.purchase_order_lines where id = p_line;
  select total_cents into v_total from public.purchase_order_line_costs where line_id = p_line;
  if l.variant_id is null or v_total is null or l.received_qty <= 0 then return; end if;
  insert into public.inventory_costs (variant_id, unit_cost_cents, purchase_line_id, updated_at)
  values (l.variant_id, v_total::numeric / l.qty, l.id, now())
  on conflict (variant_id) do update
    set unit_cost_cents = excluded.unit_cost_cents, purchase_line_id = excluded.purchase_line_id, updated_at = now();
end;
$$;
revoke all on function private.inventory_apply_line_cost(uuid) from public;

create or replace function private.inventory_line_cost_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.inventory_line_cost_applied()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.inventory_apply_line_cost(new.line_id);
  return null;
end;
$$;
revoke all on function private.inventory_line_cost_applied() from public;

-- ============================================================================
-- 8. Triggers
-- ============================================================================
create or replace trigger suppliers_touch_updated_at before update on public.suppliers
  for each row execute function private.touch_updated_at();
create or replace trigger inventory_items_touch_updated_at before update on public.inventory_items
  for each row execute function private.touch_updated_at();
create or replace trigger inventory_variants_touch_updated_at before update on public.inventory_variants
  for each row execute function private.touch_updated_at();
create or replace trigger purchase_orders_touch_updated_at before update on public.purchase_orders
  for each row execute function private.touch_updated_at();
create or replace trigger purchase_requests_touch_updated_at before update on public.purchase_requests
  for each row execute function private.touch_updated_at();

create or replace trigger inventory_variants_guard_stock before insert or update on public.inventory_variants
  for each row execute function private.inventory_guard_stock();
create or replace trigger inventory_movements_apply before insert on public.inventory_movements
  for each row execute function private.inventory_apply_movement();
create or replace trigger inventory_movements_reorder after insert on public.inventory_movements
  for each row execute function private.inventory_check_reorder();

create or replace trigger inventory_issues_author before insert on public.inventory_issues
  for each row execute function private.inventory_stamp_author();
create or replace trigger inventory_adjustments_author before insert on public.inventory_adjustments
  for each row execute function private.inventory_stamp_author();
create or replace trigger inventory_movements_author before insert on public.inventory_movements
  for each row execute function private.inventory_stamp_author();
create or replace trigger purchase_orders_author before insert on public.purchase_orders
  for each row execute function private.inventory_stamp_author();
create or replace trigger purchase_requests_author before insert on public.purchase_requests
  for each row execute function private.inventory_stamp_author();

create or replace trigger purchase_order_line_costs_touch before update on public.purchase_order_line_costs
  for each row execute function private.inventory_line_cost_changed();
create or replace trigger purchase_order_line_costs_apply after insert or update on public.purchase_order_line_costs
  for each row execute function private.inventory_line_cost_applied();

-- ============================================================================
-- 9. Funciones de la app (todo lo que mueve existencia)
-- ============================================================================

-- Salida: quién recibe (empleado o contratista), a qué proyecto o uso
-- interno, y las líneas [{variant_id, qty}]. Si no alcanza la existencia, se
-- registra igual.
create or replace function public.register_inventory_issue(
  p_issued_on date,
  p_employee_id uuid,
  p_contractor_id uuid,
  p_project_id uuid,
  p_internal_use text,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issue uuid;
  v_line jsonb;
  v_qty numeric;
  v_dec boolean;
begin
  if not private.has_module('almacen') then raise exception 'Sin permiso de Almacén.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'La salida no tiene productos.'; end if;

  insert into public.inventory_issues (issued_on, recipient_employee_id, recipient_contractor_id, project_id, internal_use, notes)
  values (coalesce(p_issued_on, private.panama_today()), p_employee_id, p_contractor_id, p_project_id, nullif(p_internal_use, ''), nullif(btrim(p_notes), ''))
  returning id into v_issue;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Cantidad inválida.'; end if;
    select i.allows_decimals into v_dec
      from public.inventory_variants v join public.inventory_items i on i.id = v.item_id
     where v.id = (v_line ->> 'variant_id')::uuid;
    if not found then raise exception 'Producto no encontrado.'; end if;
    if not v_dec and v_qty <> trunc(v_qty) then raise exception 'Ese producto no se entrega en fracciones.'; end if;
    insert into public.inventory_movements (variant_id, kind, qty, moved_on, issue_id)
    values ((v_line ->> 'variant_id')::uuid, 'salida', -v_qty, coalesce(p_issued_on, private.panama_today()), v_issue);
  end loop;
  return v_issue;
end;
$$;

-- Ajuste o conteo: [{variant_id, qty}] donde qty es lo contado (modo conteo)
-- o la diferencia (+/-). En conteo, solo se registra lo que cambia.
create or replace function public.register_inventory_adjustment(
  p_reason text,
  p_notes text,
  p_counted boolean,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adj uuid;
  v_line jsonb;
  v_qty numeric;
  v_delta numeric;
  v_stock numeric;
begin
  if not private.has_module('almacen_ajustes') then raise exception 'Sin permiso de Ajustes de inventario.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'El ajuste no tiene productos.'; end if;

  insert into public.inventory_adjustments (reason, notes) values (p_reason, nullif(btrim(p_notes), '')) returning id into v_adj;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line ->> 'qty')::numeric;
    if v_qty is null then continue; end if;
    select stock_qty into v_stock from public.inventory_variants where id = (v_line ->> 'variant_id')::uuid;
    if not found then raise exception 'Producto no encontrado.'; end if;
    if p_counted then
      if v_qty < 0 then raise exception 'Lo contado no puede ser negativo.'; end if;
      v_delta := v_qty - v_stock;
    else
      v_delta := v_qty;
    end if;
    if v_delta <> 0 then
      insert into public.inventory_movements (variant_id, kind, qty, adjustment_id)
      values ((v_line ->> 'variant_id')::uuid, 'ajuste', v_delta, v_adj);
    end if;
  end loop;
  return v_adj;
end;
$$;

-- Pedido a un proveedor con las solicitudes elegidas (una línea por
-- solicitud). Las solicitudes pasan a "pedido".
create or replace function public.create_purchase_order(
  p_supplier_id uuid,
  p_request_ids uuid[],
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order uuid;
  r public.purchase_requests;
  v_line uuid;
  v_n integer := 0;
begin
  if not private.has_module('almacen_compras') then raise exception 'Sin permiso de Compras.'; end if;
  insert into public.purchase_orders (supplier_id, notes) values (p_supplier_id, nullif(btrim(p_notes), '')) returning id into v_order;
  for r in select * from public.purchase_requests where id = any (p_request_ids) and status = 'pendiente' order by created_at loop
    insert into public.purchase_order_lines (order_id, variant_id, description, qty, unit, sort_order)
    values (v_order, r.variant_id, r.description, r.qty, r.unit, v_n)
    returning id into v_line;
    update public.purchase_requests set status = 'pedido', order_line_id = v_line where id = r.id;
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'No hay solicitudes pendientes para pedir.'; end if;
  return v_order;
end;
$$;

-- Recepción: [{line_id, qty}] lo que llegó. Entra al inventario; la línea y
-- sus solicitudes quedan recibidas cuando llega todo. Se puede recibir por partes.
create or replace function public.receive_purchase_order(
  p_order_id uuid,
  p_received_on date,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line jsonb;
  l public.purchase_order_lines;
  v_qty numeric;
begin
  if not private.has_module('almacen') then raise exception 'Sin permiso de Almacén.'; end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line ->> 'qty')::numeric;
    if v_qty is null or v_qty = 0 then continue; end if;
    if v_qty < 0 then raise exception 'Cantidad inválida.'; end if;
    select * into l from public.purchase_order_lines where id = (v_line ->> 'line_id')::uuid and order_id = p_order_id for update;
    if not found then raise exception 'Línea no encontrada.'; end if;
    update public.purchase_order_lines set received_qty = received_qty + v_qty where id = l.id;
    if l.variant_id is not null then
      insert into public.inventory_movements (variant_id, kind, qty, moved_on, purchase_line_id)
      values (l.variant_id, 'recepcion', v_qty, coalesce(p_received_on, private.panama_today()), l.id);
    end if;
    if l.received_qty + v_qty >= l.qty then
      update public.purchase_requests set status = 'recibido' where order_line_id = l.id and status = 'pedido';
    end if;
    perform private.inventory_apply_line_cost(l.id);
  end loop;

  update public.purchase_orders o
     set status = case when not exists (select 1 from public.purchase_order_lines x where x.order_id = o.id and x.received_qty < x.qty)
                       then 'recibido' else 'parcial' end
   where o.id = p_order_id and o.status <> 'cancelado'
     and exists (select 1 from public.purchase_order_lines x where x.order_id = o.id and x.received_qty > 0);
end;
$$;

-- Quién puede recibir: nombres del personal (empleados y contratistas), sin
-- ningún dato de dinero.
create or replace function public.inventory_people()
returns table (kind text, id uuid, name text, active boolean, contractor_type text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'empleado', e.id, e.name, e.status = 'ACTIVE', null::text from public.payroll_employees e where private.has_module('almacen')
  union all
  select 'contratista', c.id, c.name, c.status = 'ACTIVE', c.contractor_type from public.contractors c where private.has_module('almacen')
$$;

revoke all on function public.register_inventory_issue(date, uuid, uuid, uuid, text, text, jsonb) from public, anon;
revoke all on function public.register_inventory_adjustment(text, text, boolean, jsonb) from public, anon;
revoke all on function public.create_purchase_order(uuid, uuid[], text) from public, anon;
revoke all on function public.receive_purchase_order(uuid, date, jsonb) from public, anon;
revoke all on function public.inventory_people() from public, anon;
grant execute on function public.register_inventory_issue(date, uuid, uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.register_inventory_adjustment(text, text, boolean, jsonb) to authenticated;
grant execute on function public.create_purchase_order(uuid, uuid[], text) to authenticated;
grant execute on function public.receive_purchase_order(uuid, date, jsonb) to authenticated;
grant execute on function public.inventory_people() to authenticated;

-- ============================================================================
-- 10. RLS
-- ============================================================================
alter table public.suppliers enable row level security;
alter table public.inventory_categories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_variants enable row level security;
alter table public.inventory_item_suppliers enable row level security;
alter table public.inventory_costs enable row level security;
alter table public.inventory_issues enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_order_line_costs enable row level security;
alter table public.purchase_requests enable row level security;

-- Proveedores: los ve Almacén; los edita Compras. El catálogo (categorías,
-- productos, variantes) lo lee cualquiera, para pedir compras del catálogo.
create policy "suppliers_read" on public.suppliers for select to authenticated
  using (private.has_module('almacen'));
create policy "suppliers_write" on public.suppliers for all to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));

create policy "inventory_categories_read" on public.inventory_categories for select to authenticated using (true);
create policy "inventory_categories_write" on public.inventory_categories for all to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));

create policy "inventory_items_read" on public.inventory_items for select to authenticated using (true);
create policy "inventory_items_write" on public.inventory_items for all to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));

create policy "inventory_variants_read" on public.inventory_variants for select to authenticated using (true);
create policy "inventory_variants_write" on public.inventory_variants for all to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));

create policy "inventory_item_suppliers_read" on public.inventory_item_suppliers for select to authenticated
  using (private.has_module('almacen'));
create policy "inventory_item_suppliers_write" on public.inventory_item_suppliers for all to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));

-- Costos: Compras y Costos del almacén. Los escribe solo la base (recepción + factura).
create policy "inventory_costs_read" on public.inventory_costs for select to authenticated
  using (private.has_module('almacen_compras') or private.has_module('almacen_costos'));

-- Salidas, ajustes y movimientos: se leen con Almacén; se escriben solo por las funciones.
create policy "inventory_issues_read" on public.inventory_issues for select to authenticated
  using (private.has_module('almacen'));
create policy "inventory_adjustments_read" on public.inventory_adjustments for select to authenticated
  using (private.has_module('almacen'));
create policy "inventory_movements_read" on public.inventory_movements for select to authenticated
  using (private.has_module('almacen'));

-- Pedidos: los ve Almacén (para recibir) y los edita Compras.
create policy "purchase_orders_read" on public.purchase_orders for select to authenticated
  using (private.has_module('almacen'));
create policy "purchase_orders_write" on public.purchase_orders for all to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));
create policy "purchase_order_lines_read" on public.purchase_order_lines for select to authenticated
  using (private.has_module('almacen'));
create policy "purchase_order_lines_write" on public.purchase_order_lines for all to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));
create policy "purchase_order_line_costs_read" on public.purchase_order_line_costs for select to authenticated
  using (private.has_module('almacen_compras') or private.has_module('almacen_costos'));
create policy "purchase_order_line_costs_write" on public.purchase_order_line_costs for all to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));

-- Solicitudes: cualquiera crea y ve las suyas (y cancela las suyas pendientes); Compras ve y gestiona todas.
create policy "purchase_requests_read" on public.purchase_requests for select to authenticated
  using (private.has_module('almacen_compras') or created_by = (select auth.uid()));
create policy "purchase_requests_insert" on public.purchase_requests for insert to authenticated
  with check (private.has_module('almacen_compras')
              or (status = 'pendiente' and not auto and order_line_id is null and created_by = (select auth.uid())));
create policy "purchase_requests_update_compras" on public.purchase_requests for update to authenticated
  using (private.has_module('almacen_compras')) with check (private.has_module('almacen_compras'));
create policy "purchase_requests_update_own" on public.purchase_requests for update to authenticated
  using (created_by = (select auth.uid()) and status = 'pendiente')
  with check (created_by = (select auth.uid()) and status in ('pendiente', 'cancelado') and order_line_id is null);

-- Proyectos: Almacén los lee (para elegir a qué obra va una salida).
create policy "projects_almacen_read" on public.projects for select to authenticated
  using (private.has_module('almacen'));

revoke all on public.suppliers, public.inventory_categories, public.inventory_items, public.inventory_variants,
  public.inventory_item_suppliers, public.inventory_costs, public.inventory_issues, public.inventory_adjustments,
  public.inventory_movements, public.purchase_orders, public.purchase_order_lines, public.purchase_order_line_costs,
  public.purchase_requests from anon;
grant select, insert, update, delete on public.suppliers, public.inventory_categories, public.inventory_items,
  public.inventory_variants, public.inventory_item_suppliers, public.purchase_orders, public.purchase_order_lines,
  public.purchase_order_line_costs, public.purchase_requests to authenticated;
grant select on public.inventory_costs, public.inventory_issues, public.inventory_adjustments, public.inventory_movements to authenticated;

-- ============================================================================
-- 11. Categorías iniciales (las de JotForm, ajustadas)
-- ============================================================================
insert into public.inventory_categories (name, sort_order) values
  ('Herrajería', 1), ('Tornillería', 2), ('Láminas y cantos', 3), ('Soportes y perfiles', 4),
  ('Eléctrico', 5), ('Pintura y sellantes', 6), ('Brocas y cuchillas', 7), ('Embalaje y limpieza', 8)
on conflict (name) do nothing;
