-- Proyectos: la ubicación se separa como en la oportunidad. `location` pasa a ser el barrio; el edificio (o
-- casa) y el apartamento (solo número y letra, "19C") van en columnas propias. Al aprobar una oportunidad
-- se copian los tres. La dirección completa ("Barrio · Edificio 19C") la arma `private.project_address`.

alter table public.projects
  add column if not exists building text,
  add column if not exists unit text;

comment on column public.projects.location is 'Barrio o zona.';
comment on column public.projects.building is 'Edificio o casa ("Ph Aquapoint", "Casa 76").';
comment on column public.projects.unit is 'Apartamento: solo número o número y letra ("19C").';

-- "Barrio · Edificio 19C", con lo que haya (null si no hay nada).
create or replace function private.project_address(p_location text, p_building text, p_unit text)
returns text
language sql
immutable
set search_path to ''
as $$
  select nullif(
    concat_ws(' · ',
      nullif(btrim(p_location), ''),
      nullif(btrim(concat_ws(' ', nullif(btrim(p_building), ''), nullif(btrim(p_unit), ''))), '')),
    '');
$$;

-- Inspecciones ve la dirección completa del proyecto.
create or replace function public.inspection_projects(p_id uuid default null)
returns table(id uuid, name text, client_name text, location text, status text)
language sql
stable security definer
set search_path to ''
as $$
  select p.id, p.name, p.client_name, private.project_address(p.location, p.building, p.unit), p.status
  from public.projects p
  where private.has_module('inspecciones') and (p_id is null or p.id = p_id)
  order by p.status, p.name;
$$;

-- Aprobar una oportunidad: el proyecto nuevo lleva barrio, edificio y apartamento.
create or replace function public.approve_opportunity(p_id uuid, p_project_name text, p_project_id uuid, p_quote_ids uuid[] default null, p_designer_ids uuid[] default null)
returns uuid
language plpgsql
security definer
set search_path to ''
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
    insert into public.projects (name, client_name, designer_id, client_id, location, building, unit, status)
    values (coalesce(nullif(btrim(p_project_name), ''), nullif(btrim(o.title), ''), v_client, 'Proyecto'),
            v_client, o.designer_id, o.client_id, o.location, o.building, o.unit, 'ACTIVE')
    returning id into v_project;
  else
    update public.projects
       set designer_id = coalesce(designer_id, o.designer_id), client_id = coalesce(client_id, o.client_id),
           location = coalesce(location, o.location), building = coalesce(building, o.building), unit = coalesce(unit, o.unit)
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

-- Los proyectos activos: lo que estaba escrito en "Ubicación", separado en barrio, edificio y apartamento
-- (revisado con Carlos).
update public.projects p
   set location = v.barrio, building = v.edificio, unit = v.apt
  from (values
    ('781d57f2-f8fc-48e8-9681-893ad35c8211'::uuid, 'Paitilla', 'PH Península', '25B'),
    ('3d85c216-2660-47cd-96d7-193f704d23dd'::uuid, 'Punta Pacífica', 'PH Bellagio', '7A'),
    ('926e9a1e-2cb7-4e1a-80f8-33d150031128'::uuid, 'San Carlos, Playa Corona', 'Casa pasando Ibiza Ocean View', null),
    ('494c70ba-a167-4082-9703-a22e99789e33'::uuid, 'Santa María', 'Empire Residences', '15B'),
    ('157d8095-9615-410d-b4d6-da1f9616e704'::uuid, 'Coco del Mar', 'PH Punta Arenas', '33'),
    ('760204b7-1f5f-43e8-a7df-d4572c5f76b5'::uuid, 'Santa María', 'PH Park Eleven', '3B'),
    ('5133cb2f-0542-473d-9a4c-b946159ddea1'::uuid, 'Paitilla', 'PH Bayside', '15'),
    ('dfd293fc-7921-4e77-9ed3-684e033fc8f9'::uuid, 'Santa María', 'PH Serena', '7A'),
    ('feb68d11-d600-4400-981a-f3266cd2e8dc'::uuid, 'Punta Pacífica', 'PH Aquamare', '11B'),
    ('c05b2fad-8593-4ab5-ba36-57b581b4dfbb'::uuid, 'Costa del Este', 'PH Vitri', '44A'),
    ('44da4527-8962-4d83-aa13-cfec5547d788'::uuid, 'Paitilla', 'PH The Towers, Torre 100', '28B'),
    ('c38b5ab6-2269-4d3b-b75b-1bcbbf620855'::uuid, 'Santa María', 'The Colonial', '9A'),
    ('53459c7d-5dd7-4199-b309-9f42170138eb'::uuid, 'Costa del Este', 'Financial Park', '28'),
    ('93b458f9-9e8c-4b00-b1d0-6bf10ce7183b'::uuid, 'Santa María', 'PH The Colonial', '23C'),
    ('1ada473d-3391-40a6-bf30-5fa9f1945e78'::uuid, 'Buenaventura', null, null),
    ('e8bc0a20-0d7d-4285-9465-641caff1a5a4'::uuid, 'Santa María', 'The Grove, Casa 13', null),
    ('944d3c43-0802-45e1-9c70-5da3715e443c'::uuid, 'Paitilla', 'Royal Palace', '6'),
    ('cbceb0f3-9c3c-40dd-a700-c5d21021703a'::uuid, 'Paitilla', 'Sea Point', '18B'),
    ('e27050a9-4ecb-42e6-92da-c7828033a320'::uuid, 'Costa del Este', 'Parque del Mar, Torre 100', '15'),
    ('64072806-50e5-4b6e-a44b-654dda40d166'::uuid, 'Paitilla', 'PH Golden Palace', '16'),
    ('f1559886-90f6-4527-8a6c-a6ad2aeed257'::uuid, 'Santa María', 'PH Buenavista', '4B'),
    ('e8cc4ffe-2a7f-40bb-91fc-e488840c3c8e'::uuid, 'Punta Pacífica', 'PH Venetian', '12A'),
    ('c066b3db-c00a-4815-80a4-0f5b693969aa'::uuid, 'Colón, Calle 9, Avenida Roosevelt', 'Edificio Orquídea', '2B'),
    ('8e7b3ce5-80c0-4d6a-9f30-f30512a4300c'::uuid, 'Paitilla', 'PH Torre del Mar', '11A')
  ) as v(id, barrio, edificio, apt)
 where p.id = v.id;
