-- La oportunidad también mueve sus cotizaciones (hasta ahora solo al revés).
--  * Aprobar una oportunidad: se marcan las cotizaciones que el cliente
--    aprobó (pueden ser varias: la cocina y el closet…); las demás abiertas
--    pasan a rechazadas.
--  * Perderla: todas sus cotizaciones abiertas pasan a rechazadas.
--  * Reabrirla no reabre cotizaciones: se sigue con una nueva versión.

-- Un cambio de estado hecho por la base: permite el cambio y deja el
-- permiso como estaba (estas funciones se llaman unas a otras).
create or replace function private.close_opportunity_quotes(p_opportunity uuid, p_approved uuid[], p_project uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('ebony.quote_status', true), '');
  v_today date := private.panama_today();
begin
  perform set_config('ebony.quote_status', '1', true);
  update public.quotes
     set status = 'APROBADA', project_id = coalesce(p_project, project_id), sent_on = coalesce(sent_on, v_today),
         closed_on = v_today, follow_up_on = null
   where opportunity_id = p_opportunity and id = any (coalesce(p_approved, '{}')) and status in ('BORRADOR', 'ENVIADA');
  update public.quotes
     set status = 'RECHAZADA', closed_on = v_today, follow_up_on = null
   where opportunity_id = p_opportunity and not (id = any (coalesce(p_approved, '{}'))) and status in ('BORRADOR', 'ENVIADA');
  perform set_config('ebony.quote_status', v_prev, true);
end;
$$;

-- Aprobar: ahora con las cotizaciones aprobadas. null = no tocar las
-- cotizaciones (por compatibilidad); '{}' = ninguna (las abiertas se rechazan).
drop function if exists public.approve_opportunity(uuid, text, uuid);
create or replace function public.approve_opportunity(p_id uuid, p_project_name text, p_project_id uuid, p_quote_ids uuid[] default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.sales_opportunities;
  v_project uuid := p_project_id;
  v_client text;
begin
  if not private.has_module('cotizacion') then raise exception 'Sin permiso de Cotización.'; end if;
  select * into o from public.sales_opportunities where id = p_id for update;
  if not found then raise exception 'Oportunidad no encontrada.'; end if;
  if v_project is null then
    select string_agg(c.name, ' · ' order by c.kind desc) into v_client
      from public.clients c where c.id in (o.designer_id, o.client_id);
    insert into public.projects (name, client_name, designer_id, client_id, location, status)
    values (coalesce(nullif(btrim(p_project_name), ''), nullif(btrim(o.title), ''), v_client, 'Proyecto'),
            v_client, o.designer_id, o.client_id, o.location, 'ACTIVE')
    returning id into v_project;
  else
    update public.projects set designer_id = coalesce(designer_id, o.designer_id), client_id = coalesce(client_id, o.client_id)
     where id = v_project;
  end if;
  update public.sales_opportunities set stage = 'aprobada', project_id = v_project where id = p_id;
  if p_quote_ids is not null then
    perform private.close_opportunity_quotes(p_id, p_quote_ids, v_project);
  end if;
  return v_project;
end;
$$;
revoke all on function public.approve_opportunity(uuid, text, uuid, uuid[]) from public, anon;
grant execute on function public.approve_opportunity(uuid, text, uuid, uuid[]) to authenticated;

-- Perdida (venga de donde venga): sus cotizaciones abiertas, rechazadas.
create or replace function private.opportunity_lost_closes_quotes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage = 'perdida' and old.stage is distinct from 'perdida' then
    perform private.close_opportunity_quotes(new.id, '{}', null);
  end if;
  return null;
end;
$$;
drop trigger if exists sales_opportunities_lost_quotes on public.sales_opportunities;
create trigger sales_opportunities_lost_quotes after update of stage on public.sales_opportunities
  for each row execute function private.opportunity_lost_closes_quotes();

-- Aprobar desde la cotización: esta y las que se marquen además (p_also).
create or replace function public.set_quote_status(
  p_id uuid,
  p_status text,
  p_lost_reason text default null,
  p_lost_note text default null,
  p_project_name text default null,
  p_project_id uuid default null,
  p_also uuid[] default null
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
    if q.opportunity_id is not null then
      -- Aprueba la oportunidad con esta y las marcadas; las demás abiertas se rechazan.
      v_project := public.approve_opportunity(q.opportunity_id, p_project_name, p_project_id, array[p_id] || coalesce(p_also, '{}'));
    else
      v_project := q.project_id;
      update public.quotes set status = 'APROBADA', sent_on = coalesce(sent_on, v_today), closed_on = v_today, follow_up_on = null
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
drop function if exists public.set_quote_status(uuid, text, text, text, text, uuid);
revoke all on function public.set_quote_status(uuid, text, text, text, text, uuid, uuid[]) from public, anon;
grant execute on function public.set_quote_status(uuid, text, text, text, text, uuid, uuid[]) to authenticated;
