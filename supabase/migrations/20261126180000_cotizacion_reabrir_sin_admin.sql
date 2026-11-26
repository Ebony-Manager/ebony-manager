-- Una cotización enviada vuelve a borrador con el permiso de Cotización (antes solo el admin): después de
-- mandarla se negocia un descuento o un cambio, y no vale la pena otra versión. Al volver se marca enviada de
-- nuevo (nueva fecha de envío y de seguimiento). Igual que 20261113240000, sin el chequeo de admin.
create or replace function public.set_quote_status(
  p_id uuid,
  p_status text,
  p_lost_reason text default null,
  p_lost_note text default null,
  p_project_name text default null,
  p_project_id uuid default null,
  p_also uuid[] default null,
  p_designer_ids uuid[] default null
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
    update public.quotes set status = 'BORRADOR', sent_on = null, follow_up_on = null, terms = null where id = p_id;

  elsif p_status = 'ENVIADA' then
    if q.status <> 'BORRADOR' then raise exception 'Solo un borrador se envía.'; end if;
    update public.quotes set status = 'ENVIADA', sent_on = v_today, follow_up_on = v_today + 7, terms = private.current_quote_terms() where id = p_id;

  elsif p_status = 'APROBADA' then
    if q.status not in ('BORRADOR', 'ENVIADA') then raise exception 'Esta cotización ya está cerrada.'; end if;
    if q.opportunity_id is not null then
      -- Aprueba la oportunidad con esta y las marcadas; las demás abiertas se rechazan.
      v_project := public.approve_opportunity(q.opportunity_id, p_project_name, p_project_id, array[p_id] || coalesce(p_also, '{}'), p_designer_ids);
    else
      v_project := q.project_id;
      update public.quotes set status = 'APROBADA', sent_on = coalesce(sent_on, v_today), closed_on = v_today, follow_up_on = null,
             terms = coalesce(terms, private.current_quote_terms())
       where id = p_id;
    end if;

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
revoke all on function public.set_quote_status(uuid, text, text, text, text, uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.set_quote_status(uuid, text, text, text, text, uuid, uuid[], uuid[]) to authenticated;
