-- Diseño: al aprobarse una cotización de un proyecto, sus ítems entran solos a Diseño (Por medir), con la
-- descripción de la cotización en las notas. El botón «Traer de la cotización» queda de respaldo.

create or replace function private.add_quote_items(p_quote uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
  v_next integer;
  v_count integer;
begin
  select project_id into v_project from public.quotes where id = p_quote and status = 'APROBADA';
  if v_project is null then return 0; end if;
  select coalesce(max(sort_order), 0) into v_next from public.project_items where project_id = v_project;
  insert into public.project_items (project_id, area, name, kind, sort_order, quote_section_id, notes)
  select v_project, btrim(s.location), coalesce(nullif(btrim(s.name), ''), s.kind, 'Ítem'), coalesce(s.kind, ''),
         v_next + row_number() over (order by s.sort_order), s.id, nullif(btrim(s.description), '')
    from public.quote_sections s
   where s.quote_id = p_quote
     and not exists (select 1 from public.project_items i where i.quote_section_id = s.id);
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

create or replace function private.quote_approved_items()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'APROBADA' and new.project_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from new.status or old.project_id is distinct from new.project_id) then
    perform private.add_quote_items(new.id);
  end if;
  return null;
end; $$;
drop trigger if exists quotes_approved_items on public.quotes;
create trigger quotes_approved_items after insert or update of status, project_id on public.quotes
  for each row execute function private.quote_approved_items();

-- El botón de respaldo trae también la descripción.
create or replace function public.import_quote_items(p_project uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer := 0;
  q record;
begin
  if not (private.has_module('diseno') or private.has_module('proyectos') or private.has_module('contratistas')) then
    raise exception 'Sin permiso';
  end if;
  for q in select id from public.quotes where project_id = p_project and status = 'APROBADA' order by created_at loop
    v_count := v_count + private.add_quote_items(q.id);
  end loop;
  return v_count;
end; $$;
revoke all on function public.import_quote_items(uuid) from public, anon;
grant execute on function public.import_quote_items(uuid) to authenticated;
