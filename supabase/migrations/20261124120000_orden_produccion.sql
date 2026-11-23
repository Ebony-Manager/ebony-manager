-- Orden de producción (bloque 1: armarla y enviarla a revisión). Ver el documento "Flujo de diseño, orden de
-- producción y taller". Una orden junta ítems aprobados de un proyecto con lo que el taller necesita:
--  - 4 documentos (hoja de ruta, despiece, hoja de optimización, cotizaciones de proveedores) + electricidad si aplica;
--  - el color de cada ítem (puede quedar por definir);
--  - la hoja de mano de obra (cantidad por tarifa de contratista, la app calcula el monto);
--  - herrajes (de inventario o compra especial) y la reserva de material.
-- Etapas: borrador → en_revision (la diseñadora la envía) → por_corregir / aprobada (Brainer, bloque 2) → …
-- Permiso: Diseño, Proyectos o Contratistas (igual que los ítems).

-- 1. La orden.
create table if not exists public.production_orders (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  number        integer not null default 0,
  status        text not null default 'borrador'
                check (status in ('borrador', 'en_revision', 'por_corregir', 'aprobada', 'pedida', 'en_taller', 'cancelada')),
  status_since  timestamptz not null default now(),
  review_note   text,
  notes         text,
  sent_at       timestamptz,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, number)
);
create index if not exists production_orders_project_idx on public.production_orders (project_id);
create index if not exists production_orders_status_idx on public.production_orders (status);

-- 2. Sus ítems (un ítem está en una sola orden) con el color.
create table if not exists public.production_order_items (
  order_id    uuid not null references public.production_orders(id) on delete cascade,
  item_id     uuid not null references public.project_items(id) on delete cascade,
  color       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (order_id, item_id),
  unique (item_id)
);

-- 3. Documentos (en Drive: carpeta del proyecto → ORDEN DE PRODUCCION → Orden N).
create table if not exists public.production_order_files (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.production_orders(id) on delete cascade,
  kind           text not null check (kind in ('hoja_ruta', 'despiece', 'optimizacion', 'cotizacion_proveedor', 'electricidad')),
  drive_file_id  text not null,
  name           text not null,
  mime_type      text,
  size_bytes     bigint,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists production_order_files_order_idx on public.production_order_files (order_id);

-- 4. Hoja de mano de obra: una línea por tarifa (y por ítem, si se indica). Se guarda la tarifa del momento.
create table if not exists public.production_order_labor (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.production_orders(id) on delete cascade,
  item_id           uuid references public.project_items(id) on delete set null,
  rate_id           uuid references public.labor_rates(id) on delete set null,
  contractor_type   text not null,
  fase              text,
  unidad            text not null,
  description       text not null,
  quantity          numeric(12, 2) not null check (quantity > 0),
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  created_at        timestamptz not null default now()
);
create index if not exists production_order_labor_order_idx on public.production_order_labor (order_id);

-- 5. Herrajes: del inventario (se preparan en Almacén, bloque 3) o compra especial.
create table if not exists public.production_order_hardware (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.production_orders(id) on delete cascade,
  source             text not null check (source in ('inventario', 'especial')),
  inventory_item_id  uuid references public.inventory_items(id) on delete set null,
  description        text not null,
  quantity           numeric(12, 2) not null check (quantity > 0),
  unit               text,
  notes              text,
  created_at         timestamptz not null default now()
);
create index if not exists production_order_hardware_order_idx on public.production_order_hardware (order_id);

-- 6. Reserva de material (tableros que se apartan para la orden).
create table if not exists public.production_order_materials (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.production_orders(id) on delete cascade,
  material    text not null,
  quantity    numeric(12, 2) not null check (quantity > 0),
  unit        text not null default 'lámina',
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists production_order_materials_order_idx on public.production_order_materials (order_id);

-- 7. Historial de la orden.
create table if not exists public.production_order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.production_orders(id) on delete cascade,
  kind        text not null check (kind in ('creada', 'estado', 'nota')),
  from_status text,
  to_status   text,
  detail      text,
  actor_id    uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists production_order_events_order_idx on public.production_order_events (order_id, created_at);

-- RLS: Diseño, Proyectos o Contratistas.
alter table public.production_orders enable row level security;
alter table public.production_order_items enable row level security;
alter table public.production_order_files enable row level security;
alter table public.production_order_labor enable row level security;
alter table public.production_order_hardware enable row level security;
alter table public.production_order_materials enable row level security;
alter table public.production_order_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['production_orders', 'production_order_items', 'production_order_files', 'production_order_labor',
                           'production_order_hardware', 'production_order_materials'] loop
    execute format('drop policy if exists %I on public.%I', t || '_access', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'))
      with check (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'))$p$, t || '_access', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
drop policy if exists production_order_events_read on public.production_order_events;
create policy production_order_events_read on public.production_order_events for select to authenticated
  using (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'));
grant select on public.production_order_events to authenticated;

-- Número por proyecto (Orden 1, 2…), fecha de la etapa e historial.
create or replace function private.production_order_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext(new.project_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.production_orders where project_id = new.project_id;
  elsif new.status is distinct from old.status then
    new.status_since := now();
    if new.status = 'en_revision' then new.sent_at := now(); end if;
  end if;
  return new;
end; $$;
drop trigger if exists production_orders_before on public.production_orders;
create trigger production_orders_before before insert or update on public.production_orders
  for each row execute function private.production_order_before();

create or replace function private.production_order_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.production_order_events (order_id, kind, to_status) values (new.id, 'creada', new.status);
  elsif new.status is distinct from old.status then
    insert into public.production_order_events (order_id, kind, from_status, to_status, detail)
    values (new.id, 'estado', old.status, new.status, case when new.status = 'por_corregir' then new.review_note end);
  end if;
  return null;
end; $$;
drop trigger if exists production_orders_after on public.production_orders;
create trigger production_orders_after after insert or update on public.production_orders
  for each row execute function private.production_order_after();

-- Lo que se escoge al armar la orden, sin abrir tablas de otros módulos (tarifas, inventario, muestras):

-- Las tarifas de mano de obra vigentes.
create or replace function public.labor_rate_options()
returns table (id uuid, contractor_type text, fase text, unidad text, descripcion text, precio_cents integer)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.contractor_type, r.fase, r.unidad, r.descripcion, r.precio_cents
    from public.labor_rates r
   where r.activo and (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'))
   order by r.contractor_type, r.orden, r.descripcion
$$;
revoke all on function public.labor_rate_options() from public, anon;
grant execute on function public.labor_rate_options() to authenticated;

-- Los artículos del inventario (para herrajes que salen de Almacén).
create or replace function public.hardware_item_options()
returns table (id uuid, name text, unit text, category text)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.name, i.unit, c.name
    from public.inventory_items i
    left join public.inventory_categories c on c.id = i.category_id
   where i.active and (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas'))
   order by (c.name = 'Herrajería') desc nulls last, c.name, i.name
$$;
revoke all on function public.hardware_item_options() from public, anon;
grant execute on function public.hardware_item_options() to authenticated;

-- Colores para escoger: las muestras de pintura (las del proyecto primero) y los colores ya usados en órdenes.
create or replace function public.color_options(p_project uuid)
returns table (label text, from_project boolean)
language sql stable security definer set search_path = ''
as $$
  with c as (
    select btrim(concat_ws(' · ', nullif(btrim(s.official_code), ''), nullif(btrim(s.name), ''))) as label,
           (w.project_id = p_project) as from_project
      from public.paint_samples s
      join public.work_orders w on w.id = s.work_order_id
     where nullif(btrim(s.official_code), '') is not null or nullif(btrim(s.name), '') is not null
    union all
    select btrim(i.color), (o.project_id = p_project)
      from public.production_order_items i
      join public.production_orders o on o.id = i.order_id
     where nullif(btrim(i.color), '') is not null
  )
  select label, bool_or(coalesce(from_project, false))
    from c
   where private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas')
   group by label
   order by bool_or(coalesce(from_project, false)) desc, label
$$;
revoke all on function public.color_options(uuid) from public, anon;
grant execute on function public.color_options(uuid) to authenticated;
