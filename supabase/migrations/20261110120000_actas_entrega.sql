-- Actas de entrega: cada envío del formulario "Acta de Entrega" de JotForm
-- queda registrado en su proyecto (por el nombre del proyecto, que la app
-- pone y el formulario no deja editar). El PDF y las fotos se copian a la
-- carpeta del proyecto en Drive al llegar, porque en JotForm los envíos se
-- borran por espacio. Un proyecto puede tener varias actas (entregas parciales).

create table if not exists public.project_deliveries (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.projects(id) on delete set null,
  project_name    text not null,             -- como llegó en el formulario
  submission_id   text not null unique,      -- id del envío en JotForm (evita duplicados)
  delivered_on    date not null,
  client_name     text,
  client_email    text,
  client_id_doc   text,                      -- cédula o pasaporte
  address         text,
  items           text,
  photo_count     integer not null default 0,
  drive_folder_id text,                      -- subcarpeta del acta en Drive (PDF + fotos)
  pdf_file_id     text,
  files_error     text,                      -- si no se pudo copiar el PDF o alguna foto
  raw             jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists project_deliveries_project_idx on public.project_deliveries (project_id, delivered_on desc);

alter table public.project_deliveries enable row level security;

drop policy if exists "project_deliveries_read" on public.project_deliveries;
create policy "project_deliveries_read" on public.project_deliveries for select to authenticated
  using (private.has_module('proyectos') or private.has_module('contratistas'));

-- Asignar a mano un acta que llegó sin proyecto (o corregirla).
drop policy if exists "project_deliveries_assign" on public.project_deliveries;
create policy "project_deliveries_assign" on public.project_deliveries for update to authenticated
  using (private.has_module('proyectos') or private.has_module('contratistas'))
  with check (private.has_module('proyectos') or private.has_module('contratistas'));

grant select, update (project_id) on public.project_deliveries to authenticated;

-- Entrada del webhook (sin sesión, con el token de JotForm). Registra el acta
-- (o devuelve la que ya estaba) y dice a qué proyecto y carpeta va.
create or replace function public.ingest_project_delivery(p_token text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_project uuid;
  v_done boolean;
  v_name text := btrim(coalesce(p_data ->> 'project_name', ''));
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'jotform'
       and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_data ->> 'submission_id', '') = '' then
    raise exception 'Falta el envío';
  end if;

  select d.id, d.pdf_file_id is not null into v_id, v_done
    from public.project_deliveries d where d.submission_id = p_data ->> 'submission_id';

  if v_id is null then
    -- El proyecto por su nombre exacto (sin importar mayúsculas ni espacios);
    -- si hay más de uno, el activo; si sigue habiendo más de uno, ninguno.
    select p.id into v_project
      from public.projects p
     where lower(btrim(p.name)) = lower(v_name)
     order by (p.status = 'ACTIVE') desc
     limit 1;
    if (select count(*) from public.projects p where lower(btrim(p.name)) = lower(v_name) and p.status = 'ACTIVE') > 1 then
      v_project := null;
    end if;

    insert into public.project_deliveries (
      project_id, project_name, submission_id, delivered_on, client_name, client_email,
      client_id_doc, address, items, photo_count, raw
    ) values (
      v_project,
      coalesce(nullif(v_name, ''), '(sin nombre)'),
      p_data ->> 'submission_id',
      coalesce(nullif(p_data ->> 'delivered_on', '')::date, (now() at time zone 'America/Panama')::date),
      nullif(p_data ->> 'client_name', ''),
      nullif(p_data ->> 'client_email', ''),
      nullif(p_data ->> 'client_id_doc', ''),
      nullif(p_data ->> 'address', ''),
      nullif(p_data ->> 'items', ''),
      coalesce((p_data ->> 'photo_count')::int, 0),
      p_data -> 'raw'
    )
    returning id into v_id;
    v_done := false;
  else
    select d.project_id into v_project from public.project_deliveries d where d.id = v_id;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'done', v_done,
    'project_id', v_project,
    'project_name', (select p.name from public.projects p where p.id = v_project),
    'project_status', (select p.status from public.projects p where p.id = v_project),
    'project_folder_id', (select p.drive_folder_id from public.projects p where p.id = v_project)
  );
end;
$$;

-- Segundo paso del webhook: dónde quedaron el PDF y las fotos en Drive (y,
-- si el proyecto no tenía carpeta, la que se le creó).
create or replace function public.finish_project_delivery(p_token text, p_id uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'jotform'
       and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;

  update public.project_deliveries d
     set drive_folder_id = coalesce(nullif(p_data ->> 'drive_folder_id', ''), d.drive_folder_id),
         pdf_file_id     = coalesce(nullif(p_data ->> 'pdf_file_id', ''), d.pdf_file_id),
         files_error     = nullif(p_data ->> 'files_error', '')
   where d.id = p_id;

  if coalesce(p_data ->> 'project_folder_id', '') <> '' then
    update public.projects p
       set drive_folder_id = p_data ->> 'project_folder_id'
     where p.id = (select d.project_id from public.project_deliveries d where d.id = p_id)
       and p.drive_folder_id is null;
  end if;
end;
$$;

revoke all on function public.ingest_project_delivery(text, jsonb) from public;
revoke all on function public.finish_project_delivery(text, uuid, jsonb) from public;
grant execute on function public.ingest_project_delivery(text, jsonb) to anon, authenticated;
grant execute on function public.finish_project_delivery(text, uuid, jsonb) to anon, authenticated;
