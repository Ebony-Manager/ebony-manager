-- Cotizador: cantidad por ítem. Si se cotiza un mueble y son tres iguales,
-- el ítem lleva cantidad 3 y su total se multiplica (todo lo del ítem: sus
-- renglones, extras y márgenes), en vez de repetirlo tres veces.

alter table public.quote_sections add column if not exists qty numeric not null default 1 check (qty > 0);

-- Guardar: ahora también la cantidad del ítem.
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
    itbms_pct = (p_quote ->> 'itbms_pct')::numeric,
    notes = coalesce(p_quote ->> 'notes', ''),
    total = (p_quote ->> 'total')::numeric
  where id = v_id;

  select coalesce(array_agg((s ->> 'id')::uuid), '{}') into v_section_ids from jsonb_array_elements(p_sections) s;
  select coalesce(array_agg((l ->> 'id')::uuid), '{}') into v_line_ids from jsonb_array_elements(p_lines) l;

  delete from public.quote_lines where section_id in (select id from public.quote_sections where quote_id = v_id) and not (id = any (v_line_ids));
  delete from public.quote_sections where quote_id = v_id and not (id = any (v_section_ids));

  insert into public.quote_sections (id, quote_id, sort_order, location, name, kind, description, util_pct, sub_margin_pct, waste_sheets,
                                     waste_pct, waste_sheet_price, design_3d, extra_labor, freight, commission_pct, ccf_pct, wall_shape, corner_at, qty)
  select s.id, v_id, s.sort_order, s.location, s.name, s.kind, s.description, s.util_pct, s.sub_margin_pct, s.waste_sheets,
         s.waste_pct, s.waste_sheet_price, s.design_3d, s.extra_labor, s.freight, s.commission_pct, s.ccf_pct, s.wall_shape, s.corner_at, coalesce(s.qty, 1)
    from jsonb_populate_recordset(null::public.quote_sections, p_sections) s
  on conflict (id) do update set
    sort_order = excluded.sort_order, location = excluded.location, name = excluded.name, kind = excluded.kind,
    description = excluded.description, util_pct = excluded.util_pct, sub_margin_pct = excluded.sub_margin_pct,
    waste_sheets = excluded.waste_sheets, waste_pct = excluded.waste_pct, waste_sheet_price = excluded.waste_sheet_price,
    design_3d = excluded.design_3d, extra_labor = excluded.extra_labor, freight = excluded.freight,
    commission_pct = excluded.commission_pct, ccf_pct = excluded.ccf_pct, wall_shape = excluded.wall_shape, corner_at = excluded.corner_at, qty = excluded.qty
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
