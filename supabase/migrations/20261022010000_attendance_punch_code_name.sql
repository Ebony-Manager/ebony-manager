-- Ponchada del Jotform sin "Temp Nombre": el nombre llega igual al código
-- (ej. "EER21"). Se toma el nombre con que ese código ponchó antes, si lo
-- hay; si no, queda el código y se vincula una vez en Pagos → Asistencia.
--
-- Solo reemplaza la función. Idempotente.

create or replace function public.ingest_attendance_punch(p_token text, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_known text;
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'jotform'
       and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(p_data ->> 'dedupe_key', '') = '' or coalesce(p_data ->> 'raw_name', '') = '' then
    raise exception 'Faltan datos de la ponchada';
  end if;

  v_name := p_data ->> 'raw_name';
  if lower(v_name) = lower(coalesce(p_data ->> 'code', '')) then
    select p.raw_name into v_known
      from public.attendance_punches p
     where lower(p.code) = lower(v_name) and lower(p.raw_name) <> lower(p.code)
     order by p.created_at desc
     limit 1;
    v_name := coalesce(v_known, v_name);
  end if;

  insert into public.attendance_punches (
    source, dedupe_key, raw_name, code, punch_date, punch_minutes, kind, location, submission_id
  ) values (
    'jotform',
    p_data ->> 'dedupe_key',
    v_name,
    nullif(p_data ->> 'code', ''),
    (p_data ->> 'punch_date')::date,
    (p_data ->> 'punch_minutes')::integer,
    coalesce(nullif(p_data ->> 'kind', ''), 'unknown'),
    nullif(p_data ->> 'location', ''),
    nullif(p_data ->> 'submission_id', '')
  )
  -- JotForm puede avisar dos veces, o la ponchada ya entró por el export.
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ingest_attendance_punch(text, jsonb) from public;
grant execute on function public.ingest_attendance_punch(text, jsonb) to anon, authenticated;
