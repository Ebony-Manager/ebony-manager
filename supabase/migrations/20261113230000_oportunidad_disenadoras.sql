-- Diseñadoras en la oportunidad: se escogen al crearla o editarla y al aprobarla; al aprobar pasan al
-- proyecto (project_designers). Quien tiene Cotización puede verlas y escogerlas (solo nombre y cargo).

alter table public.sales_opportunities add column if not exists designer_employee_ids uuid[] not null default '{}';

-- A quién se puede asignar: ahora también lo ve quien lleva Cotización (para escoger al crear la oportunidad).
create or replace function public.designer_candidates()
returns table (id uuid, name text, "position" text, has_access boolean)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.name, e.position, exists (select 1 from public.allowed_emails a where a.employee_id = e.id)
    from public.payroll_employees e
   where e.status = 'ACTIVE'
     and (private.has_module('proyectos') or private.has_module('contratistas') or private.has_module('cotizacion'))
   order by (e.position ilike '%diseñ%') desc, e.name
$$;
revoke all on function public.designer_candidates() from public, anon;
grant execute on function public.designer_candidates() to authenticated;

-- Aprobar: con las diseñadoras. null = las que ya tiene la oportunidad.
drop function if exists public.approve_opportunity(uuid, text, uuid, uuid[]);
create or replace function public.approve_opportunity(p_id uuid, p_project_name text, p_project_id uuid, p_quote_ids uuid[] default null, p_designer_ids uuid[] default null)
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
  update public.sales_opportunities
     set stage = 'aprobada', project_id = v_project,
         designer_employee_ids = coalesce(p_designer_ids, designer_employee_ids)
   where id = p_id
  returning designer_employee_ids into o.designer_employee_ids;
  insert into public.project_designers (project_id, employee_id)
  select v_project, e from unnest(o.designer_employee_ids) e
   where exists (select 1 from public.payroll_employees pe where pe.id = e)
  on conflict do nothing;
  if p_quote_ids is not null then
    perform private.close_opportunity_quotes(p_id, p_quote_ids, v_project);
  end if;
  return v_project;
end;
$$;
revoke all on function public.approve_opportunity(uuid, text, uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.approve_opportunity(uuid, text, uuid, uuid[], uuid[]) to authenticated;

-- Para la lista de proyectos: quiénes son las diseñadoras de cada uno (solo nombres).
create or replace function public.project_designer_names()
returns table (project_id uuid, names text[])
language sql stable security definer set search_path = ''
as $$
  select d.project_id, array_agg(e.name order by e.name)
    from public.project_designers d
    join public.payroll_employees e on e.id = d.employee_id
   where private.has_module('proyectos') or private.has_module('contratistas') or private.has_module('diseno')
   group by d.project_id
$$;
revoke all on function public.project_designer_names() from public, anon;
grant execute on function public.project_designer_names() to authenticated;
