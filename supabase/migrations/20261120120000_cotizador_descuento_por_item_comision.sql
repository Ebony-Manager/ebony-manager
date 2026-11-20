-- Cotizador: descuento por ítem y comisión de la arquitecta por cotización (decisión de Carlos, 20 nov).
--  * Cada ítem puede tener su descuento (en % o en monto); el cliente lo ve en la cotización.
--  * La comisión de la arquitecta es UN % para toda la cotización (5, 10, 15…), va repartida dentro del precio de
--    cada ítem (el cliente no la ve) y sale del precio ya con todos los descuentos (los de cada ítem y el general).
--    Un ítem puede marcarse "sin comisión".
--  * El recargo de tarjeta (4%) es de la cotización y también cubre la comisión.
--  * Las cotizaciones que ya existen se pasan a lo nuevo SIN que cambie ningún número: la comisión de la cotización
--    es la que tenían sus ítems; los ítems que iban sin comisión quedan marcados "sin comisión"; el recargo de
--    tarjeta es el que tenían sus ítems. (Verificado: en ninguna cotización hay dos % de comisión distintos ni dos
--    recargos distintos entre sus ítems de receta.) Las columnas viejas de cada ítem se dejan (sin usar).

-- 1. Columnas nuevas.
alter table public.quotes
  add column if not exists commission_pct numeric(8,3) not null default 0 check (commission_pct >= 0 and commission_pct <= 100),
  add column if not exists ccf_pct numeric(8,3) not null default 4 check (ccf_pct >= 0 and ccf_pct <= 100);

alter table public.quote_sections
  add column if not exists discount_type text not null default 'pct' check (discount_type in ('pct', 'amount')),
  add column if not exists discount_value numeric(14,4) not null default 0 check (discount_value >= 0),
  add column if not exists no_commission boolean not null default false;

-- 2. Pasar las cotizaciones que ya existen (también las enviadas y aprobadas: sus números no cambian).
update public.quotes q
   set commission_pct = coalesce(x.comm, 0),
       ccf_pct = coalesce(x.ccf, q.ccf_pct)
  from (
    select quote_id,
           max(commission_pct) filter (where price_mode = 'recipe') as comm,
           max(ccf_pct) filter (where price_mode = 'recipe') as ccf
      from public.quote_sections
     group by quote_id
  ) x
 where x.quote_id = q.id;

-- Los ítems de una cotización bloqueada no se pueden tocar: se apaga la guardia solo para este paso.
alter table public.quote_sections disable trigger quote_sections_locked_guard;
update public.quote_sections s
   set no_commission = true
  from public.quotes q
 where q.id = s.quote_id
   and s.price_mode = 'recipe'
   and s.commission_pct < q.commission_pct;
alter table public.quote_sections enable trigger quote_sections_locked_guard;

-- 3. Una cotización enviada tampoco cambia su comisión ni su recargo.
create or replace function private.quote_locked_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is distinct from new.status and coalesce(current_setting('ebony.quote_status', true), '') <> '1' then
    raise exception 'El estado de la cotización se cambia con sus botones (set_quote_status).';
  end if;
  if old.status <> 'BORRADOR' and (
       new.client_name, new.designer_name, new.project_name, new.designer_id, new.designer_contact_id, new.client_id,
       new.opportunity_id, new.quote_date, new.delivery_days, new.valid_days, new.lang, new.discount_type,
       new.discount_value, new.itbms_pct, new.notes, new.total, new.base_number, new.version,
       new.commission_pct, new.ccf_pct
     ) is distinct from (
       old.client_name, old.designer_name, old.project_name, old.designer_id, old.designer_contact_id, old.client_id,
       old.opportunity_id, old.quote_date, old.delivery_days, old.valid_days, old.lang, old.discount_type,
       old.discount_value, old.itbms_pct, old.notes, old.total, old.base_number, old.version,
       old.commission_pct, old.ccf_pct
     ) then
    raise exception 'BLOQUEADA';
  end if;
  return new;
end;
$$;

-- 4. Guardar: también la comisión y el recargo de la cotización, y el descuento y "sin comisión" de cada ítem.
create or replace function public.save_quote(p_quote jsonb, p_sections jsonb, p_lines jsonb, p_expected timestamptz default null)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_quote ->> 'id')::uuid;
  v_current timestamptz;
  v_status text;
  v_section_ids uuid[];
  v_line_ids uuid[];
  v_now timestamptz;
begin
  select updated_at, status into v_current, v_status from public.quotes where id = v_id for update;
  if not found then raise exception 'COTIZACION_NO_EXISTE'; end if;
  if p_expected is not null and date_trunc('milliseconds', v_current) <> date_trunc('milliseconds', p_expected) then
    raise exception 'CONFLICTO';
  end if;

  if v_status <> 'BORRADOR' then
    update public.quotes set pdf_detail = p_quote ->> 'pdf_detail', updated_at = now() where id = v_id returning updated_at into v_now;
    return v_now;
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
    lang = p_quote ->> 'lang',
    pdf_detail = p_quote ->> 'pdf_detail',
    discount_type = p_quote ->> 'discount_type',
    discount_value = (p_quote ->> 'discount_value')::numeric,
    commission_pct = coalesce((p_quote ->> 'commission_pct')::numeric, commission_pct),
    ccf_pct = coalesce((p_quote ->> 'ccf_pct')::numeric, ccf_pct),
    itbms_pct = (p_quote ->> 'itbms_pct')::numeric,
    notes = coalesce(p_quote ->> 'notes', ''),
    total = (p_quote ->> 'total')::numeric
  where id = v_id;

  select coalesce(array_agg((s ->> 'id')::uuid), '{}') into v_section_ids from jsonb_array_elements(p_sections) s;
  select coalesce(array_agg((l ->> 'id')::uuid), '{}') into v_line_ids from jsonb_array_elements(p_lines) l;

  delete from public.quote_lines where section_id in (select id from public.quote_sections where quote_id = v_id) and not (id = any (v_line_ids));
  delete from public.quote_sections where quote_id = v_id and not (id = any (v_section_ids));

  insert into public.quote_sections (id, quote_id, sort_order, location, name, kind, description, util_pct, sub_margin_pct, waste_sheets,
                                     waste_pct, waste_sheet_price, design_3d, extra_labor, freight, wall_shape, corner_at, qty,
                                     price_mode, direct_price, discount_type, discount_value, no_commission)
  select s.id, v_id, s.sort_order, s.location, s.name, s.kind, s.description, s.util_pct, s.sub_margin_pct, s.waste_sheets,
         s.waste_pct, s.waste_sheet_price, s.design_3d, s.extra_labor, s.freight, s.wall_shape, s.corner_at, coalesce(s.qty, 1),
         coalesce(s.price_mode, 'recipe'), coalesce(s.direct_price, 0),
         coalesce(s.discount_type, 'pct'), coalesce(s.discount_value, 0), coalesce(s.no_commission, false)
    from jsonb_populate_recordset(null::public.quote_sections, p_sections) s
  on conflict (id) do update set
    sort_order = excluded.sort_order, location = excluded.location, name = excluded.name, kind = excluded.kind,
    description = excluded.description, util_pct = excluded.util_pct, sub_margin_pct = excluded.sub_margin_pct,
    waste_sheets = excluded.waste_sheets, waste_pct = excluded.waste_pct, waste_sheet_price = excluded.waste_sheet_price,
    design_3d = excluded.design_3d, extra_labor = excluded.extra_labor, freight = excluded.freight,
    wall_shape = excluded.wall_shape, corner_at = excluded.corner_at, qty = excluded.qty,
    price_mode = excluded.price_mode, direct_price = excluded.direct_price,
    discount_type = excluded.discount_type, discount_value = excluded.discount_value, no_commission = excluded.no_commission
  where public.quote_sections.quote_id = v_id;

  insert into public.quote_lines (id, section_id, sort_order, item_id, name, category, finish, unit, shape, mode, width, height, pieces, qty,
                                  unit_price, price_overridden, wall, pos_x, pos_y, host_line_id, gola_ml, gola_price)
  select l.id, l.section_id, l.sort_order, l.item_id, l.name, l.category, l.finish, l.unit, l.shape, l.mode, l.width, l.height, l.pieces, l.qty,
         l.unit_price, l.price_overridden, l.wall, l.pos_x, l.pos_y, l.host_line_id, coalesce(l.gola_ml, 0), coalesce(l.gola_price, 0)
    from jsonb_populate_recordset(null::public.quote_lines, p_lines) l
   where l.section_id = any (v_section_ids)
  on conflict (id) do update set
    section_id = excluded.section_id, sort_order = excluded.sort_order, item_id = excluded.item_id, name = excluded.name,
    category = excluded.category, finish = excluded.finish, unit = excluded.unit, shape = excluded.shape, mode = excluded.mode,
    width = excluded.width, height = excluded.height, pieces = excluded.pieces, qty = excluded.qty, unit_price = excluded.unit_price,
    price_overridden = excluded.price_overridden, wall = excluded.wall, pos_x = excluded.pos_x, pos_y = excluded.pos_y,
    host_line_id = excluded.host_line_id, gola_ml = excluded.gola_ml, gola_price = excluded.gola_price;

  update public.quotes set updated_at = now() where id = v_id returning updated_at into v_now;
  return v_now;
end;
$$;
revoke all on function public.save_quote(jsonb, jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.save_quote(jsonb, jsonb, jsonb, timestamptz) to authenticated;
