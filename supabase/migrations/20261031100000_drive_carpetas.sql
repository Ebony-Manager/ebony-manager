-- Google Drive: cada oportunidad y cada proyecto con su carpeta en la Unidad
-- compartida. La app crea la carpeta la primera vez que se abre "Archivos";
-- al aprobar, el proyecto hereda la carpeta de su oportunidad (los planos y
-- renders de la etapa de venta siguen ahí).

alter table public.projects add column if not exists drive_folder_id text;

create or replace function private.opportunity_folder_to_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null and new.drive_folder_id is not null then
    update public.projects set drive_folder_id = new.drive_folder_id
     where id = new.project_id and drive_folder_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists sales_opportunity_folder_to_project on public.sales_opportunities;
create trigger sales_opportunity_folder_to_project
  after insert or update of project_id, drive_folder_id on public.sales_opportunities
  for each row execute function private.opportunity_folder_to_project();

-- Guardar la carpeta de un proyecto (la primera vez): la ve quien ve el proyecto.
create or replace function public.set_project_drive_folder(p_id uuid, p_folder_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_folder text;
begin
  if not (private.has_module('proyectos') or private.has_module('contratistas') or private.has_module('cotizacion')) then
    raise exception 'SIN_PERMISO';
  end if;
  update public.projects set drive_folder_id = coalesce(drive_folder_id, p_folder_id)
   where id = p_id
   returning drive_folder_id into v_folder;
  return v_folder;
end;
$$;

revoke all on function public.set_project_drive_folder(uuid, text) from public, anon;
grant execute on function public.set_project_drive_folder(uuid, text) to authenticated;
