-- El nombre del proyecto de una cotización sigue al de su oportunidad (o su proyecto) mientras la
-- cotización esté en Borrador o Enviada. Aprobada o Rechazada queda congelada: es el documento que firmó
-- el cliente. Antes el nombre era una copia que se quedaba vieja al editar la oportunidad.

-- Una cotización Enviada está bloqueada; solo este sincronizador (con la marca de sesión) puede cambiarle
-- el nombre del proyecto, y nada más.
create or replace function private.quote_locked_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_name_sync boolean := coalesce(current_setting('ebony.quote_name_sync', true), '') = '1';
begin
  if old.status is distinct from new.status and coalesce(current_setting('ebony.quote_status', true), '') <> '1' then
    raise exception 'El estado de la cotización se cambia con sus botones (set_quote_status).';
  end if;
  if old.status <> 'BORRADOR' and (
       new.client_name, new.designer_name, case when v_name_sync then old.project_name else new.project_name end,
       new.designer_id, new.designer_contact_id, new.client_id,
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

create or replace function private.sync_quote_project_names()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('ebony.quote_name_sync', '1', true);
  if tg_table_name = 'sales_opportunities' then
    if new.title is distinct from old.title then
      update public.quotes q set project_name = btrim(new.title)
       where q.opportunity_id = new.id and q.project_id is null
         and q.status in ('BORRADOR', 'ENVIADA') and q.project_name is distinct from btrim(new.title);
    end if;
  elsif tg_table_name = 'projects' then
    if new.name is distinct from old.name then
      update public.quotes q set project_name = btrim(new.name)
       where q.project_id = new.id
         and q.status in ('BORRADOR', 'ENVIADA') and q.project_name is distinct from btrim(new.name);
    end if;
  end if;
  perform set_config('ebony.quote_name_sync', '0', true);
  return new;
end;
$$;
revoke all on function private.sync_quote_project_names() from public, anon, authenticated;

drop trigger if exists sales_opportunities_sync_quote_names on public.sales_opportunities;
create trigger sales_opportunities_sync_quote_names after update of title on public.sales_opportunities
  for each row execute function private.sync_quote_project_names();

drop trigger if exists projects_sync_quote_names on public.projects;
create trigger projects_sync_quote_names after update of name on public.projects
  for each row execute function private.sync_quote_project_names();

-- Ponerlas al día ahora.
select set_config('ebony.quote_name_sync', '1', true);
update public.quotes q set project_name = btrim(p.name)
  from public.projects p
 where q.project_id = p.id and q.status in ('BORRADOR', 'ENVIADA') and q.project_name is distinct from btrim(p.name);
update public.quotes q set project_name = btrim(o.title)
  from public.sales_opportunities o
 where q.opportunity_id = o.id and q.project_id is null and q.status in ('BORRADOR', 'ENVIADA')
   and btrim(o.title) <> '' and q.project_name is distinct from btrim(o.title);
select set_config('ebony.quote_name_sync', '0', true);
