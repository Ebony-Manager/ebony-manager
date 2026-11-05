-- Cotizador · Etapa 1: la cotización amarrada al resto de la app.
--  * Dueño: una oportunidad (trabajo nuevo), un proyecto (algo más en una obra
--    que ya tenemos) o solo el cliente (una reparación, algo rápido).
--  * Cliente siempre de Clientes: firma/arquitecto (+ su contacto) y/o cliente
--    final. client_name / designer_name / project_name quedan como copia para
--    la lista y la búsqueda.
--  * Número automático COT-2635, COT-2636…; las versiones del mismo número
--    son COT-2635-V2, -V3 (ej. "cotízame en melamina / en pintado").
--  * Validez (días; 30 por defecto, se cambia en Costos).
--  * Guardado en una sola llamada y atómico (save_quote), con aviso si otra
--    persona la cambió mientras tanto.

-- ============================================================================
-- 1. Columnas
-- ============================================================================
alter table public.quotes add column if not exists base_number integer;
alter table public.quotes add column if not exists version integer not null default 1 check (version >= 1);
alter table public.quotes add column if not exists designer_id uuid references public.clients (id) on delete set null;
alter table public.quotes add column if not exists designer_contact_id uuid references public.client_contacts (id) on delete set null;
alter table public.quotes add column if not exists client_id uuid references public.clients (id) on delete set null;
alter table public.quotes add column if not exists valid_days integer not null default 30 check (valid_days >= 0);
create index if not exists quotes_opportunity_idx on public.quotes (opportunity_id);
create index if not exists quotes_project_idx on public.quotes (project_id);
create index if not exists quotes_client_idx on public.quotes (client_id);
create index if not exists quotes_designer_idx on public.quotes (designer_id);

insert into public.quote_cost_inputs (key, kind, label, value, unit, sort_order)
values ('def_valid_days', 'default', 'Validez de la cotización', 30, 'dias', 115)
on conflict (key) do nothing;

-- ============================================================================
-- 2. Numeración: COT-<n>[-V<versión>]
-- ============================================================================
create sequence if not exists public.quote_number_seq start with 2635;

create or replace function private.quote_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.base_number is null then
    new.base_number := nextval('public.quote_number_seq');
    new.version := 1;
  end if;
  new.number := 'COT-' || new.base_number || case when new.version > 1 then '-V' || new.version else '' end;
  return new;
end;
$$;
drop trigger if exists quotes_number on public.quotes;
create trigger quotes_number before insert or update of base_number, version, number on public.quotes
  for each row execute function private.quote_number();

-- Las cotizaciones de hoy, por fecha de creación (la de prueba se borra).
delete from public.quotes where client_name = 'Ariana Grande' and status = 'BORRADOR';
update public.quotes q set base_number = o.n, version = 1
  from (select id, 2634 + row_number() over (order by created_at, id) as n from public.quotes where base_number is null) o
 where q.id = o.id;
select setval('public.quote_number_seq', greatest(2634, (select coalesce(max(base_number), 2634) from public.quotes)));

create unique index if not exists quotes_number_version_uq on public.quotes (base_number, version);
grant usage, select on sequence public.quote_number_seq to authenticated;

-- ============================================================================
-- 3. Guardado atómico
-- ============================================================================
-- p_quote: encabezado; p_sections / p_lines: filas ya armadas por la app (los
-- mismos nombres de columna). Todo o nada. p_expected: el updated_at que tenía
-- la app; si otra persona guardó después, CONFLICTO y no se pisa nada.
-- Devuelve el nuevo updated_at. Corre con los permisos de quien guarda (RLS).
create or replace function public.save_quote(p_quote jsonb, p_sections jsonb, p_lines jsonb, p_expected timestamptz default null)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_quote ->> 'id')::uuid;
  v_current timestamptz;
  v_section_ids uuid[];
  v_line_ids uuid[];
  v_now timestamptz;
begin
  select updated_at into v_current from public.quotes where id = v_id for update;
  if not found then raise exception 'COTIZACION_NO_EXISTE'; end if;
  if p_expected is not null and date_trunc('milliseconds', v_current) <> date_trunc('milliseconds', p_expected) then
    raise exception 'CONFLICTO';
  end if;

  update public.quotes set
    client_name = coalesce(p_quote ->> 'client_name', ''),
    designer_name = coalesce(p_quote ->> 'designer_name', ''),
    project_name = coalesce(p_quote ->> 'project_name', ''),
    designer_id = (p_quote ->> 'designer_id')::uuid,
    designer_contact_id = (p_quote ->> 'designer_contact_id')::uuid,
    client_id = (p_quote ->> 'client_id')::uuid,
    opportunity_id = (p_quote ->> 'opportunity_id')::uuid,
    project_id = (p_quote ->> 'project_id')::uuid,
    quote_date = (p_quote ->> 'quote_date')::date,
    delivery_days = (p_quote ->> 'delivery_days')::integer,
    valid_days = coalesce((p_quote ->> 'valid_days')::integer, 30),
    status = p_quote ->> 'status',
    lang = p_quote ->> 'lang',
    pdf_detail = p_quote ->> 'pdf_detail',
    discount_type = p_quote ->> 'discount_type',
    discount_value = (p_quote ->> 'discount_value')::numeric,
    itbms_pct = (p_quote ->> 'itbms_pct')::numeric,
    notes = coalesce(p_quote ->> 'notes', ''),
    total = (p_quote ->> 'total')::numeric
  where id = v_id;

  select coalesce(array_agg((s ->> 'id')::uuid), '{}') into v_section_ids from jsonb_array_elements(p_sections) s;
  select coalesce(array_agg((l ->> 'id')::uuid), '{}') into v_line_ids from jsonb_array_elements(p_lines) l;

  -- Lo que se quitó (los renglones de un ítem borrado se van con él).
  delete from public.quote_lines where section_id in (select id from public.quote_sections where quote_id = v_id) and not (id = any (v_line_ids));
  delete from public.quote_sections where quote_id = v_id and not (id = any (v_section_ids));

  insert into public.quote_sections (id, quote_id, sort_order, location, name, kind, description, util_pct, sub_margin_pct, waste_sheets,
                                     waste_pct, waste_sheet_price, design_3d, extra_labor, freight, commission_pct, ccf_pct, wall_shape, corner_at, plan_id)
  select s.id, v_id, s.sort_order, s.location, s.name, s.kind, s.description, s.util_pct, s.sub_margin_pct, s.waste_sheets,
         s.waste_pct, s.waste_sheet_price, s.design_3d, s.extra_labor, s.freight, s.commission_pct, s.ccf_pct, s.wall_shape, s.corner_at, s.plan_id
    from jsonb_populate_recordset(null::public.quote_sections, p_sections) s
  on conflict (id) do update set
    sort_order = excluded.sort_order, location = excluded.location, name = excluded.name, kind = excluded.kind,
    description = excluded.description, util_pct = excluded.util_pct, sub_margin_pct = excluded.sub_margin_pct,
    waste_sheets = excluded.waste_sheets, waste_pct = excluded.waste_pct, waste_sheet_price = excluded.waste_sheet_price,
    design_3d = excluded.design_3d, extra_labor = excluded.extra_labor, freight = excluded.freight,
    commission_pct = excluded.commission_pct, ccf_pct = excluded.ccf_pct, wall_shape = excluded.wall_shape, corner_at = excluded.corner_at, plan_id = excluded.plan_id
  where public.quote_sections.quote_id = v_id;

  insert into public.quote_lines (id, section_id, sort_order, item_id, name, category, finish, unit, shape, mode, width, height, pieces, qty,
                                  unit_price, price_overridden, wall, pos_x, pos_y, host_line_id, gola_ml, gola_price, piece_ids)
  select l.id, l.section_id, l.sort_order, l.item_id, l.name, l.category, l.finish, l.unit, l.shape, l.mode, l.width, l.height, l.pieces, l.qty,
         l.unit_price, l.price_overridden, l.wall, l.pos_x, l.pos_y, l.host_line_id, coalesce(l.gola_ml, 0), coalesce(l.gola_price, 0), coalesce(l.piece_ids, '{}')
    from jsonb_populate_recordset(null::public.quote_lines, p_lines) l
   where l.section_id = any (v_section_ids)
  on conflict (id) do update set
    section_id = excluded.section_id, sort_order = excluded.sort_order, item_id = excluded.item_id, name = excluded.name,
    category = excluded.category, finish = excluded.finish, unit = excluded.unit, shape = excluded.shape, mode = excluded.mode,
    width = excluded.width, height = excluded.height, pieces = excluded.pieces, qty = excluded.qty, unit_price = excluded.unit_price,
    price_overridden = excluded.price_overridden, wall = excluded.wall, pos_x = excluded.pos_x, pos_y = excluded.pos_y,
    host_line_id = excluded.host_line_id, gola_ml = excluded.gola_ml, gola_price = excluded.gola_price, piece_ids = excluded.piece_ids;

  update public.quotes set updated_at = now() where id = v_id returning updated_at into v_now;
  return v_now;
end;
$$;
revoke all on function public.save_quote(jsonb, jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.save_quote(jsonb, jsonb, jsonb, timestamptz) to authenticated;

-- Proyectos para elegir como dueño de una cotización (quien cotiza puede no
-- tener el permiso de Proyectos): solo id, nombre y quiénes.
create or replace function public.quote_projects()
returns table (id uuid, name text, status text, designer_id uuid, client_id uuid)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.status, p.designer_id, p.client_id
    from public.projects p
   where private.has_module('cotizacion')
   order by p.name;
$$;
revoke all on function public.quote_projects() from public, anon;
grant execute on function public.quote_projects() to authenticated;

-- ============================================================================
-- 4. Amarrar las cotizaciones que ya existen (aprobado por Ebony, 5 nov 2026)
-- ============================================================================
do $$
declare
  v_pe uuid := (select id from public.clients where name = 'Proyecto Estudio' and kind = 'arquitecto' limit 1);
  v_cristy uuid := (select id from public.clients where name = 'Cristy Lopez' limit 1);
  v_teo uuid;
  v_opp uuid;
begin
  -- Casa Bettsak → su oportunidad (Mallol).
  select id into v_opp from public.sales_opportunities where title = 'Casa Bettsak' limit 1;
  if v_opp is not null then
    update public.quotes q set opportunity_id = v_opp,
           designer_id = o.designer_id, designer_contact_id = o.designer_contact_id, client_id = o.client_id,
           designer_name = coalesce((select name from public.clients where id = o.designer_id), q.designer_name)
      from public.sales_opportunities o
     where o.id = v_opp and q.client_name = 'Casa Bettsak' and q.opportunity_id is null;
    update public.sales_opportunities set stage = 'cotizando' where id = v_opp and stage = 'por_cotizar';
  end if;

  -- Teo Zebede – Royal Palace → cliente nuevo + oportunidad nueva.
  select id into v_teo from public.clients where name = 'Teo Zebede' limit 1;
  if v_teo is null then
    insert into public.clients (name, kind) values ('Teo Zebede', 'cliente') returning id into v_teo;
  end if;
  if exists (select 1 from public.quotes where client_name = 'Teo Zebede' and opportunity_id is null) then
    insert into public.sales_opportunities (title, client_id, stage) values ('Royal Palace', v_teo, 'cotizando') returning id into v_opp;
    update public.quotes set opportunity_id = v_opp, client_id = v_teo where client_name = 'Teo Zebede' and opportunity_id is null;
  end if;

  -- Proyecto Estudio – Casa 1B y The Woods → una oportunidad cada una.
  if v_pe is not null then
    if exists (select 1 from public.quotes where client_name = 'Proyecto Estudio' and project_name = 'Casa 1B' and opportunity_id is null) then
      insert into public.sales_opportunities (title, designer_id, stage) values ('Casa 1B', v_pe, 'cotizando') returning id into v_opp;
      update public.quotes set opportunity_id = v_opp, designer_id = v_pe, client_name = '', designer_name = 'Proyecto Estudio'
       where client_name = 'Proyecto Estudio' and project_name = 'Casa 1B' and opportunity_id is null;
    end if;
    if exists (select 1 from public.quotes where client_name = 'Proyecto Estudio' and project_name = 'The Woods' and opportunity_id is null) then
      insert into public.sales_opportunities (title, designer_id, stage) values ('The Woods', v_pe, 'cotizando') returning id into v_opp;
      update public.quotes set opportunity_id = v_opp, designer_id = v_pe, client_name = '', designer_name = 'Proyecto Estudio'
       where client_name = 'Proyecto Estudio' and project_name = 'The Woods' and opportunity_id is null;
    end if;
  end if;

  -- Cristy Lopez → solo el cliente (arquitecta).
  if v_cristy is not null then
    update public.quotes set designer_id = v_cristy, client_name = '', designer_name = 'Cristy Lopez'
     where client_name = 'Arq. Cristy Lopez' and opportunity_id is null and designer_id is null;
  end if;
end;
$$;
