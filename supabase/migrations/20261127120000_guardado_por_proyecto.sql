-- Almacén → Guardado por proyecto: cosas de un solo proyecto que se guardan hasta usarlas (un riel especial
-- comprado en Amazon, la manigueta que trajo el cliente, un tirador que el cliente compró por su lado).
-- No son inventario (no se cuentan ni se reponen): se registra qué es, de qué proyecto, de dónde salió,
-- dónde quedó guardado y, cuando llega el momento, a quién se entregó.
--
-- Tres orígenes:
--   compra  = una solicitud "Especial para proyecto" de Compras que Almacén recibió (se crea sola al recibir).
--   directa = algo que Ebony ya compró por su lado y ya llegó (se registra a mano, con su costo).
--   cliente = algo que trajo el cliente (sin costo).
-- Lo registran Almacén, Diseño o Proyectos (sobre todo las diseñadoras).

-- 1. Solicitudes "Especial para proyecto" -------------------------------------------------------------
alter table public.purchase_requests
  add column if not exists for_project boolean not null default false;
alter table public.purchase_requests drop constraint if exists purchase_requests_for_project;
alter table public.purchase_requests add constraint purchase_requests_for_project
  check (not for_project or (project_id is not null and variant_id is null));
comment on column public.purchase_requests.for_project is
  'Especial para proyecto: al recibirla, queda en Almacén → Guardado por proyecto (no suma al inventario).';

-- 2. Lo guardado ---------------------------------------------------------------------------------------
create table if not exists public.project_stored_items (
  id                          uuid        primary key default gen_random_uuid(),
  project_id                  uuid        not null references public.projects (id) on delete cascade,
  project_item_id             uuid        references public.project_items (id) on delete set null,
  description                 text        not null check (btrim(description) <> ''),
  qty                         numeric     not null default 1 check (qty > 0),
  unit                        text,
  origin                      text        not null check (origin in ('compra', 'directa', 'cliente')),
  purchase_line_id            uuid        unique references public.purchase_order_lines (id) on delete set null,
  supplier_id                 uuid        references public.suppliers (id) on delete set null,
  location                    text,
  photo_path                  text,
  notes                       text,
  received_on                 date        not null default private.panama_today(),
  received_by                 uuid        references public.profiles (id) on delete set null,
  received_by_name            text,
  status                      text        not null default 'en_almacen' check (status in ('en_almacen', 'entregado')),
  delivered_on                date,
  delivered_to_employee_id    uuid        references public.payroll_employees (id) on delete set null,
  delivered_to_contractor_id  uuid        references public.contractors (id) on delete set null,
  delivered_to_name           text,
  delivered_by_name           text,
  delivery_notes              text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint project_stored_items_delivered check (status = 'en_almacen' or (delivered_on is not null and delivered_to_name is not null))
);
create index if not exists project_stored_items_project_idx on public.project_stored_items (project_id, status);
create index if not exists project_stored_items_item_idx on public.project_stored_items (project_item_id);

-- Costo de lo que Ebony compró por su lado (lo de Compras ya lo tiene la línea del pedido). Aparte, como en
-- Compras, para que solo lo vea quien ve costos.
create table if not exists public.project_stored_item_costs (
  item_id      uuid        primary key references public.project_stored_items (id) on delete cascade,
  total_cents  bigint      not null check (total_cents >= 0),
  updated_at   timestamptz not null default now()
);

-- Quién puede trabajar con esto.
create or replace function private.can_stored_items()
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.has_module('almacen') or private.has_module('diseno') or private.has_module('proyectos') $$;
revoke all on function private.can_stored_items() from public, anon;
grant execute on function private.can_stored_items() to authenticated;

create or replace function private.can_stored_costs()
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.has_module('almacen_compras') or private.has_module('almacen_costos') $$;
revoke all on function private.can_stored_costs() from public, anon;
grant execute on function private.can_stored_costs() to authenticated;

-- Quién lo registra y la fecha de cambio.
create or replace function private.project_stored_items_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.received_by := coalesce(new.received_by, auth.uid());
    new.received_by_name := coalesce(new.received_by_name, (select p.full_name from public.profiles p where p.id = auth.uid()));
  else
    new.updated_at := now();
    if new.status = 'entregado' and old.status <> 'entregado' then
      new.delivered_by_name := (select p.full_name from public.profiles p where p.id = auth.uid());
    elsif new.status = 'en_almacen' then
      new.delivered_on := null;
      new.delivered_to_employee_id := null;
      new.delivered_to_contractor_id := null;
      new.delivered_to_name := null;
      new.delivered_by_name := null;
      new.delivery_notes := null;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists project_stored_items_before on public.project_stored_items;
create trigger project_stored_items_before before insert or update on public.project_stored_items
  for each row execute function private.project_stored_items_before();

-- 3. Al recibir en Almacén una solicitud especial, se guarda sola ------------------------------------------
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
  insert into public.project_stored_items (project_id, description, qty, unit, origin, purchase_line_id, supplier_id, notes)
  values (r.project_id, coalesce(nullif(btrim(new.description), ''), r.description), new.received_qty, new.unit, 'compra', new.id,
          (select o.supplier_id from public.purchase_orders o where o.id = new.order_id), nullif(btrim(r.reason), ''))
  on conflict (purchase_line_id) do update set qty = excluded.qty;
  return null;
end;
$$;
drop trigger if exists purchase_order_lines_stored_item on public.purchase_order_lines;
create trigger purchase_order_lines_stored_item after update of received_qty on public.purchase_order_lines
  for each row execute function private.stored_item_from_purchase();

-- 4. Leer: todo con nombres (y el costo solo para quien ve costos) ----------------------------------------
create or replace function public.project_stored_items_list(p_project uuid default null)
returns table (
  id uuid, project_id uuid, project_name text, project_item_id uuid, project_item_name text,
  description text, qty numeric, unit text, origin text, supplier_id uuid, supplier_name text,
  location text, photo_path text, notes text, received_on date, received_by_name text,
  status text, delivered_on date, delivered_to_name text, delivered_by_name text, delivery_notes text,
  total_cents bigint, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.project_id, p.name, s.project_item_id, nullif(concat_ws(' · ', nullif(btrim(pi.area), ''), pi.name), ''),
         s.description, s.qty, s.unit, s.origin, s.supplier_id, sp.name,
         s.location, s.photo_path, s.notes, s.received_on, s.received_by_name,
         s.status, s.delivered_on, s.delivered_to_name, s.delivered_by_name, s.delivery_notes,
         case when private.can_stored_costs() then coalesce(c.total_cents, lc.total_cents) end,
         s.created_at
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

-- Lo especial que se pidió y todavía no llega ("Por llegar").
create or replace function public.project_incoming_items(p_project uuid default null)
returns table (id uuid, project_id uuid, project_name text, description text, qty numeric, unit text, status text, requested_by text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.project_id, p.name, r.description, r.qty, r.unit, r.status, r.created_by_name, r.created_at
    from public.purchase_requests r
    join public.projects p on p.id = r.project_id
   where private.can_stored_items() and r.for_project and r.status in ('pendiente', 'pedido')
     and (p_project is null or r.project_id = p_project)
   order by r.created_at
$$;
revoke all on function public.project_incoming_items(uuid) from public, anon;
grant execute on function public.project_incoming_items(uuid) to authenticated;

-- A quién se puede entregar (personal y contratistas activos), sin pedir el permiso de Almacén.
create or replace function public.stored_item_people()
returns table (kind text, id uuid, name text, detail text)
language sql stable security definer set search_path = ''
as $$
  select 'empleado', e.id, e.name, e.position from public.payroll_employees e
   where private.can_stored_items() and e.status = 'ACTIVE'
  union all
  select 'contratista', c.id, c.name, c.contractor_type from public.contractors c
   where private.can_stored_items() and c.status = 'ACTIVE'
  order by 3
$$;
revoke all on function public.stored_item_people() from public, anon;
grant execute on function public.stored_item_people() to authenticated;

-- 5. Permisos -------------------------------------------------------------------------------------------
alter table public.project_stored_items enable row level security;
alter table public.project_stored_item_costs enable row level security;

drop policy if exists "project_stored_items_read" on public.project_stored_items;
create policy "project_stored_items_read" on public.project_stored_items for select to authenticated
  using (private.can_stored_items());
drop policy if exists "project_stored_items_insert" on public.project_stored_items;
create policy "project_stored_items_insert" on public.project_stored_items for insert to authenticated
  with check (private.can_stored_items() and origin in ('directa', 'cliente') and purchase_line_id is null);
drop policy if exists "project_stored_items_update" on public.project_stored_items;
create policy "project_stored_items_update" on public.project_stored_items for update to authenticated
  using (private.can_stored_items()) with check (private.can_stored_items());
-- Borrar (si se registró por error): lo registrado a mano; lo que viene de Compras se corrige en Compras.
drop policy if exists "project_stored_items_delete" on public.project_stored_items;
create policy "project_stored_items_delete" on public.project_stored_items for delete to authenticated
  using (private.can_stored_items() and origin <> 'compra');

-- El costo lo leen solo quienes ven costos; se escribe con set_stored_item_cost (quien registra lo que Ebony ya
-- compró pone el costo: tiene la factura, aunque después no lo vea en la lista).
drop policy if exists "project_stored_item_costs_read" on public.project_stored_item_costs;
create policy "project_stored_item_costs_read" on public.project_stored_item_costs for select to authenticated
  using (private.can_stored_costs());

grant select, insert, update, delete on public.project_stored_items to authenticated;
grant select on public.project_stored_item_costs to authenticated;

create or replace function public.set_stored_item_cost(p_item uuid, p_cents bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.can_stored_items() then raise exception 'Sin permiso.'; end if;
  if not exists (select 1 from public.project_stored_items where id = p_item and origin = 'directa') then return; end if;
  if p_cents is null then
    delete from public.project_stored_item_costs where item_id = p_item;
  else
    if p_cents < 0 then raise exception 'Costo inválido.'; end if;
    insert into public.project_stored_item_costs (item_id, total_cents) values (p_item, p_cents)
    on conflict (item_id) do update set total_cents = excluded.total_cents, updated_at = now();
  end if;
end;
$$;
revoke all on function public.set_stored_item_cost(uuid, bigint) from public, anon;
grant execute on function public.set_stored_item_cost(uuid, bigint) to authenticated;

-- Los ítems de un proyecto (para decir "es para el closet principal"), sin pedir el permiso de Diseño.
create or replace function public.stored_item_project_items(p_project uuid)
returns table (id uuid, label text)
language sql stable security definer set search_path = ''
as $$
  select i.id, concat_ws(' · ', nullif(btrim(i.area), ''), i.name)
    from public.project_items i
   where private.can_stored_items() and i.project_id = p_project
   order by i.area, i.sort_order, i.name
$$;
revoke all on function public.stored_item_project_items(uuid) from public, anon;
grant execute on function public.stored_item_project_items(uuid) to authenticated;

-- 6. Fotos: en el bucket del Almacén, carpeta stored/ ------------------------------------------------------
drop policy if exists "inventory_photos_stored_insert" on storage.objects;
create policy "inventory_photos_stored_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'inventory-photos' and name like 'stored/%' and private.can_stored_items());
drop policy if exists "inventory_photos_stored_delete" on storage.objects;
create policy "inventory_photos_stored_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'inventory-photos' and name like 'stored/%' and private.can_stored_items());
