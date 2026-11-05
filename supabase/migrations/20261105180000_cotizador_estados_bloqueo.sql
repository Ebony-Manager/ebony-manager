-- Cotizador · Etapa 2: estados con reglas y cotización bloqueada al enviarla.
--  * Solo un borrador se edita. Enviada, aprobada o rechazada queda
--    bloqueada: para cambiarla se crea una nueva versión (-V2, -V3…). Lo
--    único que se puede cambiar es el detalle del PDF (cómo se presenta).
--  * El estado cambia solo con set_quote_status, que aplica las reglas:
--      - Enviada: guarda la fecha y el seguimiento a los 7 días.
--      - Aprobada: si es de una oportunidad, la aprueba y crea (o enlaza) el
--        proyecto; las otras versiones abiertas de esa oportunidad pasan a
--        rechazadas.
--      - Rechazada: si es de una oportunidad y no le queda otra versión
--        abierta, la oportunidad pasa a Perdida con su motivo (obligatorio).
--      - Volver a borrador: solo el admin y solo desde Enviada (un error al
--        marcarla).

alter table public.quotes add column if not exists sent_on date;
alter table public.quotes add column if not exists closed_on date;
alter table public.quotes add column if not exists follow_up_on date;

-- ============================================================================
-- 1. Bloqueo
-- ============================================================================
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
       new.discount_value, new.itbms_pct, new.notes, new.total, new.base_number, new.version
     ) is distinct from (
       old.client_name, old.designer_name, old.project_name, old.designer_id, old.designer_contact_id, old.client_id,
       old.opportunity_id, old.quote_date, old.delivery_days, old.valid_days, old.lang, old.discount_type,
       old.discount_value, old.itbms_pct, old.notes, old.total, old.base_number, old.version
     ) then
    raise exception 'BLOQUEADA';
  end if;
  return new;
end;
$$;
drop trigger if exists quotes_locked_guard on public.quotes;
create trigger quotes_locked_guard before update on public.quotes
  for each row execute function private.quote_locked_guard();

-- Ítems y renglones de una cotización bloqueada tampoco se tocan. (Al borrar
-- la cotización entera, sus ítems se van en cascada: ahí ya no existe.)
create or replace function private.quote_child_locked_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quote uuid;
  v_status text;
begin
  if tg_table_name = 'quote_sections' then
    v_quote := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;
  else
    select s.quote_id into v_quote from public.quote_sections s
     where s.id = case when tg_op = 'DELETE' then old.section_id else new.section_id end;
  end if;
  select status into v_status from public.quotes where id = v_quote;
  if v_status is not null and v_status <> 'BORRADOR' then
    raise exception 'BLOQUEADA';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists quote_sections_locked_guard on public.quote_sections;
create trigger quote_sections_locked_guard before insert or update or delete on public.quote_sections
  for each row execute function private.quote_child_locked_guard();
drop trigger if exists quote_lines_locked_guard on public.quote_lines;
create trigger quote_lines_locked_guard before insert or update or delete on public.quote_lines
  for each row execute function private.quote_child_locked_guard();

-- Borrar: un borrador cualquiera con el permiso; una ya enviada, solo el admin.
create or replace function private.quote_delete_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'BORRADOR' and not private.is_admin() then
    raise exception 'Solo el admin puede borrar una cotización ya enviada.';
  end if;
  return old;
end;
$$;
drop trigger if exists quotes_delete_guard on public.quotes;
create trigger quotes_delete_guard before delete on public.quotes
  for each row execute function private.quote_delete_guard();

-- ============================================================================
-- 2. Guardar: ya no cambia el estado; bloqueada, solo el detalle del PDF
-- ============================================================================
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
                                     waste_pct, waste_sheet_price, design_3d, extra_labor, freight, commission_pct, ccf_pct, wall_shape, corner_at)
  select s.id, v_id, s.sort_order, s.location, s.name, s.kind, s.description, s.util_pct, s.sub_margin_pct, s.waste_sheets,
         s.waste_pct, s.waste_sheet_price, s.design_3d, s.extra_labor, s.freight, s.commission_pct, s.ccf_pct, s.wall_shape, s.corner_at
    from jsonb_populate_recordset(null::public.quote_sections, p_sections) s
  on conflict (id) do update set
    sort_order = excluded.sort_order, location = excluded.location, name = excluded.name, kind = excluded.kind,
    description = excluded.description, util_pct = excluded.util_pct, sub_margin_pct = excluded.sub_margin_pct,
    waste_sheets = excluded.waste_sheets, waste_pct = excluded.waste_pct, waste_sheet_price = excluded.waste_sheet_price,
    design_3d = excluded.design_3d, extra_labor = excluded.extra_labor, freight = excluded.freight,
    commission_pct = excluded.commission_pct, ccf_pct = excluded.ccf_pct, wall_shape = excluded.wall_shape, corner_at = excluded.corner_at
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

-- ============================================================================
-- 3. Cambiar el estado
-- ============================================================================
-- Devuelve el proyecto (al aprobar una de oportunidad) o null.
create or replace function public.set_quote_status(
  p_id uuid,
  p_status text,
  p_lost_reason text default null,
  p_lost_note text default null,
  p_project_name text default null,
  p_project_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  q public.quotes;
  v_today date := private.panama_today();
  v_project uuid;
  v_open_siblings int;
begin
  if not private.has_module('cotizacion') then raise exception 'Sin permiso de Cotización.'; end if;
  select * into q from public.quotes where id = p_id for update;
  if not found then raise exception 'COTIZACION_NO_EXISTE'; end if;
  if q.status = p_status then return q.project_id; end if;
  perform set_config('ebony.quote_status', '1', true);

  if p_status = 'BORRADOR' then
    if q.status <> 'ENVIADA' then raise exception 'Solo una cotización enviada vuelve a borrador.'; end if;
    if not private.is_admin() then raise exception 'Solo el admin puede volver una cotización a borrador.'; end if;
    update public.quotes set status = 'BORRADOR', sent_on = null, follow_up_on = null where id = p_id;

  elsif p_status = 'ENVIADA' then
    if q.status <> 'BORRADOR' then raise exception 'Solo un borrador se envía.'; end if;
    update public.quotes set status = 'ENVIADA', sent_on = v_today, follow_up_on = v_today + 7 where id = p_id;

  elsif p_status = 'APROBADA' then
    if q.status not in ('BORRADOR', 'ENVIADA') then raise exception 'Esta cotización ya está cerrada.'; end if;
    v_project := q.project_id;
    if q.opportunity_id is not null then
      v_project := public.approve_opportunity(q.opportunity_id, p_project_name, p_project_id);
      -- Las otras versiones abiertas de la misma oportunidad quedan rechazadas.
      update public.quotes set status = 'RECHAZADA', closed_on = v_today, follow_up_on = null
       where opportunity_id = q.opportunity_id and id <> p_id and status in ('BORRADOR', 'ENVIADA');
    end if;
    update public.quotes set status = 'APROBADA', project_id = v_project, sent_on = coalesce(sent_on, v_today),
           closed_on = v_today, follow_up_on = null
     where id = p_id;

  elsif p_status = 'RECHAZADA' then
    if q.status not in ('BORRADOR', 'ENVIADA') then raise exception 'Esta cotización ya está cerrada.'; end if;
    update public.quotes set status = 'RECHAZADA', closed_on = v_today, follow_up_on = null where id = p_id;
    if q.opportunity_id is not null then
      select count(*) into v_open_siblings from public.quotes
       where opportunity_id = q.opportunity_id and status in ('BORRADOR', 'ENVIADA');
      if v_open_siblings = 0 then
        if p_lost_reason is null then raise exception 'MOTIVO_REQUERIDO'; end if;
        update public.sales_opportunities set stage = 'perdida', lost_reason = p_lost_reason, lost_note = nullif(btrim(p_lost_note), '')
         where id = q.opportunity_id and stage not in ('aprobada', 'perdida');
      end if;
    end if;

  else
    raise exception 'Estado no válido: %', p_status;
  end if;

  perform set_config('ebony.quote_status', '', true);
  return v_project;
end;
$$;
revoke all on function public.set_quote_status(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.set_quote_status(uuid, text, text, text, text, uuid) to authenticated;
