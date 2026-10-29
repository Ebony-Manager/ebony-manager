-- Almacén · Etapa 2: herramientas (préstamo y devolución) y envases por
-- devolver (High Tack, Celulón, broca de pared…).
--
-- Herramientas: cada una es una pieza física con su número ("Engalletadora
-- #1"). Se presta a un empleado o contratista (de Personal), con proyecto y
-- fecha de devolución opcionales; sin fecha, queda vencida a los 7 días. Al
-- devolverla se dice cómo llegó (bien, necesita reparación, dañada o
-- perdida) y su estado cambia solo. No se cobra nada.
--
-- Permisos: prestar y devolver es del Almacén; crear o editar herramientas y
-- cambiarles el estado a mano, de Ajustes de inventario o Compras.
--
-- Envases: cada salida de un producto "devolvible" deja a la persona
-- debiendo el envase hasta que lo devuelve. Cuenta desde hoy: lo que salió
-- antes de este control no queda como pendiente.

-- ============================================================================
-- 1. Herramientas y préstamos
-- ============================================================================
create table if not exists public.inventory_tools (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null check (btrim(name) <> ''),
  number      integer     check (number is null or number > 0),
  category    text        not null default 'electrica' check (category in ('electrica', 'manual', 'medicion', 'corte', 'otra')),
  brand       text,
  notes       text,
  photo_path  text,
  status      text        not null default 'disponible' check (status in ('disponible', 'prestada', 'reparacion', 'danada', 'perdida')),
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.inventory_tools is 'Herramientas que se prestan y vuelven (Almacén → Herramientas). El estado lo mueven prestar/devolver.';
create unique index if not exists inventory_tools_name_number_idx on public.inventory_tools (lower(btrim(name)), coalesce(number, 0));

create table if not exists public.inventory_tool_loans (
  id                       uuid        primary key default gen_random_uuid(),
  tool_id                  uuid        not null references public.inventory_tools (id) on delete cascade,
  recipient_employee_id    uuid        references public.payroll_employees (id) on delete restrict,
  recipient_contractor_id  uuid        references public.contractors (id) on delete restrict,
  project_id               uuid        references public.projects (id) on delete set null,
  lent_on                  date        not null default private.panama_today(),
  due_on                   date,
  returned_on              date,
  return_condition         text        check (return_condition in ('bien', 'reparacion', 'danada', 'perdida')),
  notes                    text,
  return_notes             text,
  created_by               uuid        references public.profiles (id) on delete set null,
  created_by_name          text,
  returned_by_name         text,
  created_at               timestamptz not null default now(),
  constraint inventory_tool_loans_one_recipient check ((recipient_employee_id is null) <> (recipient_contractor_id is null)),
  constraint inventory_tool_loans_returned check ((returned_on is null) = (return_condition is null))
);
create unique index if not exists inventory_tool_loans_open_idx on public.inventory_tool_loans (tool_id) where returned_on is null;
create index if not exists inventory_tool_loans_tool_idx on public.inventory_tool_loans (tool_id, lent_on desc);
create index if not exists inventory_tool_loans_employee_idx on public.inventory_tool_loans (recipient_employee_id) where returned_on is null;
create index if not exists inventory_tool_loans_contractor_idx on public.inventory_tool_loans (recipient_contractor_id) where returned_on is null;

drop trigger if exists inventory_tools_touch on public.inventory_tools;
create trigger inventory_tools_touch before update on public.inventory_tools
  for each row execute function private.touch_updated_at();
drop trigger if exists inventory_tool_loans_author on public.inventory_tool_loans;
create trigger inventory_tool_loans_author before insert on public.inventory_tool_loans
  for each row execute function private.inventory_stamp_author();

alter table public.inventory_tools enable row level security;
alter table public.inventory_tool_loans enable row level security;
drop policy if exists "inventory_tools_read" on public.inventory_tools;
create policy "inventory_tools_read" on public.inventory_tools for select to authenticated using (private.has_module('almacen'));
drop policy if exists "inventory_tools_write" on public.inventory_tools;
create policy "inventory_tools_write" on public.inventory_tools for all to authenticated
  using (private.has_module('almacen_ajustes') or private.has_module('almacen_compras'))
  with check (private.has_module('almacen_ajustes') or private.has_module('almacen_compras'));
drop policy if exists "inventory_tool_loans_read" on public.inventory_tool_loans;
create policy "inventory_tool_loans_read" on public.inventory_tool_loans for select to authenticated using (private.has_module('almacen'));
grant select, insert, update, delete on public.inventory_tools to authenticated;
-- Los préstamos solo se escriben con lend_tools / return_tool.
grant select on public.inventory_tool_loans to authenticated;

-- Prestar una o varias herramientas a una persona.
create or replace function public.lend_tools(
  p_tool_ids uuid[],
  p_employee_id uuid,
  p_contractor_id uuid,
  p_project_id uuid,
  p_due_on date,
  p_notes text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tool public.inventory_tools;
  v_n integer := 0;
begin
  if not private.has_module('almacen') then raise exception 'Sin permiso de Almacén.'; end if;
  if (p_employee_id is null) = (p_contractor_id is null) then raise exception 'Falta a quién se le presta.'; end if;
  if coalesce(cardinality(p_tool_ids), 0) = 0 then raise exception 'Elige al menos una herramienta.'; end if;
  if p_due_on is not null and p_due_on < private.panama_today() then raise exception 'La fecha de devolución ya pasó.'; end if;
  for v_tool in select * from public.inventory_tools where id = any (p_tool_ids) for update loop
    if v_tool.status <> 'disponible' or not v_tool.active then
      raise exception '% no está disponible.', btrim(v_tool.name || coalesce(' #' || v_tool.number, ''));
    end if;
    insert into public.inventory_tool_loans (tool_id, recipient_employee_id, recipient_contractor_id, project_id, due_on, notes)
    values (v_tool.id, p_employee_id, p_contractor_id, p_project_id, p_due_on, nullif(btrim(p_notes), ''));
    update public.inventory_tools set status = 'prestada' where id = v_tool.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.lend_tools(uuid[], uuid, uuid, uuid, date, text) from public, anon;
grant execute on function public.lend_tools(uuid[], uuid, uuid, uuid, date, text) to authenticated;

-- Devolver: cómo llegó decide el estado de la herramienta.
create or replace function public.return_tool(p_loan_id uuid, p_condition text, p_notes text, p_returned_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.inventory_tool_loans;
begin
  if not private.has_module('almacen') then raise exception 'Sin permiso de Almacén.'; end if;
  if p_condition not in ('bien', 'reparacion', 'danada', 'perdida') then raise exception 'Estado inválido.'; end if;
  select * into v_loan from public.inventory_tool_loans where id = p_loan_id for update;
  if not found then raise exception 'Préstamo no encontrado.'; end if;
  if v_loan.returned_on is not null then raise exception 'Esa herramienta ya se devolvió.'; end if;
  update public.inventory_tool_loans
     set returned_on = greatest(coalesce(p_returned_on, private.panama_today()), v_loan.lent_on),
         return_condition = p_condition,
         return_notes = nullif(btrim(p_notes), ''),
         returned_by_name = (select coalesce(nullif(p.full_name, ''), p.email) from public.profiles p where p.id = (select auth.uid()))
   where id = p_loan_id;
  update public.inventory_tools
     set status = case p_condition when 'bien' then 'disponible' else p_condition end
   where id = v_loan.tool_id;
end;
$$;
revoke all on function public.return_tool(uuid, text, text, date) from public, anon;
grant execute on function public.return_tool(uuid, text, text, date) to authenticated;

-- "Prestada" solo la ponen y la quitan lend_tools / return_tool (corren como
-- dueño de la base): editando a mano no se presta ni se libera una herramienta.
create or replace function private.inventory_tools_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and 'prestada' in (old.status, new.status) and current_user = 'authenticated' then
    raise exception 'Una herramienta se presta o se devuelve desde Prestar / Devolver.';
  end if;
  return new;
end;
$$;
drop trigger if exists inventory_tools_guard on public.inventory_tools;
create trigger inventory_tools_guard before update of status on public.inventory_tools
  for each row execute function private.inventory_tools_guard();

-- Fotos de herramientas: mismo bucket del catálogo, carpeta tools/.
drop policy if exists "inventory_photos_tools_insert" on storage.objects;
create policy "inventory_photos_tools_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'inventory-photos' and name like 'tools/%' and private.has_module('almacen_ajustes'));
drop policy if exists "inventory_photos_tools_delete" on storage.objects;
create policy "inventory_photos_tools_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'inventory-photos' and name like 'tools/%' and private.has_module('almacen_ajustes'));

-- ============================================================================
-- 2. Envases por devolver
-- ============================================================================
create table if not exists public.inventory_container_returns (
  movement_id      uuid        primary key references public.inventory_movements (id) on delete cascade,
  returned_on      date        not null default private.panama_today(),
  created_by       uuid        references public.profiles (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now()
);
comment on table public.inventory_container_returns is 'Envase devuelto de una salida de un producto devolvible (una fila por línea de salida).';
drop trigger if exists inventory_container_returns_author on public.inventory_container_returns;
create trigger inventory_container_returns_author before insert on public.inventory_container_returns
  for each row execute function private.inventory_stamp_author();
alter table public.inventory_container_returns enable row level security;
drop policy if exists "inventory_container_returns_read" on public.inventory_container_returns;
create policy "inventory_container_returns_read" on public.inventory_container_returns for select to authenticated using (private.has_module('almacen'));
drop policy if exists "inventory_container_returns_write" on public.inventory_container_returns;
create policy "inventory_container_returns_write" on public.inventory_container_returns for insert to authenticated with check (private.has_module('almacen'));
grant select, insert on public.inventory_container_returns to authenticated;

-- Desde cuándo se controlan los envases (lo anterior no queda pendiente).
create or replace function private.inventory_containers_since()
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select timestamptz '2026-10-30 00:00:00-05' $$;

-- Lo que una persona (o todas, con los dos en null) tiene por devolver:
-- herramientas prestadas y envases de productos devolvibles.
create or replace function public.inventory_pending_returns(p_employee_id uuid, p_contractor_id uuid)
returns table (
  kind          text,
  id            uuid,
  name          text,
  photo_path    text,
  employee_id   uuid,
  contractor_id uuid,
  person        text,
  since         date,
  due_on        date,
  overdue       boolean,
  qty           numeric,
  unit          text,
  project       text
)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (select private.panama_today() d)
  select 'herramienta', l.id, btrim(t.name || coalesce(' #' || t.number, '')), t.photo_path,
         l.recipient_employee_id, l.recipient_contractor_id, coalesce(e.name, c.name),
         l.lent_on, coalesce(l.due_on, l.lent_on + 7),
         coalesce(l.due_on, l.lent_on + 7) < (select d from today),
         1::numeric, null::text, p.name
    from public.inventory_tool_loans l
    join public.inventory_tools t on t.id = l.tool_id
    left join public.payroll_employees e on e.id = l.recipient_employee_id
    left join public.contractors c on c.id = l.recipient_contractor_id
    left join public.projects p on p.id = l.project_id
   where l.returned_on is null and private.has_module('almacen')
     and (p_employee_id is null or l.recipient_employee_id = p_employee_id)
     and (p_contractor_id is null or l.recipient_contractor_id = p_contractor_id)
  union all
  select 'envase', m.id, btrim(i.name || coalesce(' · ' || nullif(v.label, ''), '')), i.photo_path,
         s.recipient_employee_id, s.recipient_contractor_id, coalesce(e.name, c.name),
         s.issued_on, null::date, false,
         -m.qty, i.unit, p.name
    from public.inventory_movements m
    join public.inventory_issues s on s.id = m.issue_id
    join public.inventory_variants v on v.id = m.variant_id
    join public.inventory_items i on i.id = v.item_id
    left join public.payroll_employees e on e.id = s.recipient_employee_id
    left join public.contractors c on c.id = s.recipient_contractor_id
    left join public.projects p on p.id = s.project_id
   where i.kind = 'devolvible' and m.kind = 'salida'
     and m.created_at >= private.inventory_containers_since()
     and not exists (select 1 from public.inventory_container_returns r where r.movement_id = m.id)
     and private.has_module('almacen')
     and (p_employee_id is null or s.recipient_employee_id = p_employee_id)
     and (p_contractor_id is null or s.recipient_contractor_id = p_contractor_id)
   order by 8, 3;
$$;
revoke all on function public.inventory_pending_returns(uuid, uuid) from public, anon;
grant execute on function public.inventory_pending_returns(uuid, uuid) to authenticated;

-- ============================================================================
-- 3. Avisos y resumen diario
-- ============================================================================
insert into public.notification_types (key, module, title, description, default_push, sort_order) values
  ('warehouse_tool_overdue', 'almacen', 'Herramienta vencida', 'Una herramienta prestada pasó su fecha de devolución (o lleva 7 días sin fecha).', true, 85)
on conflict (key) do update set module = excluded.module, title = excluded.title,
  description = excluded.description, default_push = excluded.default_push, sort_order = excluded.sort_order;

-- Lo llama el cron diario (mismo token del resumen): un aviso por préstamo vencido.
create or replace function public.inventory_tool_overdue_notices(p_token text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'almacen_resumen' and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;
  insert into public.app_notifications (kind, type_key, title, body, href, dedupe_key)
  select 'warehouse_tool_overdue', 'warehouse_tool_overdue', 'Herramienta vencida',
         btrim(t.name || coalesce(' #' || t.number, '')) || ' · ' || coalesce(e.name, c.name, '—') || ' · desde el ' || to_char(l.lent_on, 'DD/MM'),
         '/almacen/herramientas', 'warehouse_tool_overdue:' || l.id
    from public.inventory_tool_loans l
    join public.inventory_tools t on t.id = l.tool_id
    left join public.payroll_employees e on e.id = l.recipient_employee_id
    left join public.contractors c on c.id = l.recipient_contractor_id
   where l.returned_on is null and coalesce(l.due_on, l.lent_on + 7) < private.panama_today()
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.inventory_tool_overdue_notices(text) from public;
grant execute on function public.inventory_tool_overdue_notices(text) to anon, authenticated;

create or replace function public.inventory_daily_summary(p_token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
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
    'overdue_tools', (select coalesce(jsonb_agg(x order by x->>'due_on'), '[]') from (
        select jsonb_build_object('name', btrim(t.name || coalesce(' #' || t.number, '')), 'person', coalesce(e.name, c.name, '—'),
                                  'lent_on', l.lent_on, 'due_on', coalesce(l.due_on, l.lent_on + 7),
                                  'days', v_today - coalesce(l.due_on, l.lent_on + 7)) x
          from public.inventory_tool_loans l
          join public.inventory_tools t on t.id = l.tool_id
          left join public.payroll_employees e on e.id = l.recipient_employee_id
          left join public.contractors c on c.id = l.recipient_contractor_id
         where l.returned_on is null and coalesce(l.due_on, l.lent_on + 7) < v_today) q),
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
$function$;
