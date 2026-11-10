-- Autorizaciones a pintura y a embalaje: igual que las actas de entrega
-- (formulario de JotForm → registro en el proyecto + PDF y fotos en Drive),
-- en la misma tabla con su tipo. Llevan quién aprobó, quién recibió, las
-- observaciones y algunos datos sueltos (acabado, color, piezas…).

alter table public.project_deliveries
  add column if not exists kind text not null default 'entrega' check (kind in ('entrega', 'pintura', 'embalaje')),
  add column if not exists approved_by text,
  add column if not exists received_by text,
  add column if not exists notes text,
  add column if not exists details jsonb;

drop index if exists public.project_deliveries_project_idx;
create index if not exists project_deliveries_project_idx on public.project_deliveries (project_id, kind, delivered_on desc);

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
  v_kind text := coalesce(nullif(p_data ->> 'kind', ''), 'entrega');
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'jotform' and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_data ->> 'submission_id', '') = '' then raise exception 'Falta el envío'; end if;
  if v_kind not in ('entrega', 'pintura', 'embalaje') then raise exception 'Tipo inválido'; end if;

  select d.id, d.pdf_file_id is not null into v_id, v_done
    from public.project_deliveries d where d.submission_id = p_data ->> 'submission_id';

  if v_id is null then
    select p.id into v_project from public.projects p
     where lower(btrim(p.name)) = lower(v_name) order by (p.status = 'ACTIVE') desc limit 1;
    if (select count(*) from public.projects p where lower(btrim(p.name)) = lower(v_name) and p.status = 'ACTIVE') > 1 then
      v_project := null;
    end if;
    insert into public.project_deliveries (
      kind, project_id, project_name, submission_id, delivered_on, client_name, client_email,
      client_id_doc, address, items, photo_count, approved_by, received_by, notes, details, raw
    ) values (
      v_kind, v_project, coalesce(nullif(v_name, ''), '(sin nombre)'), p_data ->> 'submission_id',
      coalesce(nullif(p_data ->> 'delivered_on', '')::date, (now() at time zone 'America/Panama')::date),
      nullif(p_data ->> 'client_name', ''), nullif(p_data ->> 'client_email', ''),
      nullif(p_data ->> 'client_id_doc', ''), nullif(p_data ->> 'address', ''),
      nullif(p_data ->> 'items', ''), coalesce((p_data ->> 'photo_count')::int, 0),
      nullif(p_data ->> 'approved_by', ''), nullif(p_data ->> 'received_by', ''),
      nullif(p_data ->> 'notes', ''), p_data -> 'details', p_data -> 'raw'
    ) returning id into v_id;
    v_done := false;
  else
    select d.project_id into v_project from public.project_deliveries d where d.id = v_id;
  end if;

  return jsonb_build_object(
    'id', v_id, 'done', v_done, 'project_id', v_project,
    'project_name', (select p.name from public.projects p where p.id = v_project),
    'project_status', (select p.status from public.projects p where p.id = v_project),
    'project_folder_id', (select p.drive_folder_id from public.projects p where p.id = v_project)
  );
end;
$$;

revoke all on function public.ingest_project_delivery(text, jsonb) from public;
grant execute on function public.ingest_project_delivery(text, jsonb) to anon, authenticated;
