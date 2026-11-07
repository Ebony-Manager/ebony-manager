-- Settings → Conexiones: cada conexión externa (cron diario, webhook de
-- Jotform, feriados.io, Google Drive…) anota su último resultado, para ver de
-- un vistazo si algo dejó de funcionar en vez de que falle en silencio.
--
-- Una fila por conexión (o parte de una, ej. 'cron:feriados'): la última vez
-- que funcionó y el último error con su fecha. Solo el admin la lee.
-- Escriben: el cron y el webhook (con su token, sin sesión) y la app con la
-- sesión del usuario (ej. Drive), siempre por record_integration_run.

create table if not exists public.integration_runs (
  key            text primary key check (key ~ '^[a-z0-9_:]{1,60}$'),
  last_ok_at     timestamptz,
  last_detail    text,
  last_error_at  timestamptz,
  last_error     text,
  updated_at     timestamptz not null default now()
);
alter table public.integration_runs enable row level security;
drop policy if exists "integration_runs_admin_read" on public.integration_runs;
create policy "integration_runs_admin_read" on public.integration_runs for select to authenticated using (private.is_admin());

create or replace function public.record_integration_run(p_token text, p_key text, p_ok boolean, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_detail text := left(nullif(btrim(p_detail), ''), 500);
begin
  -- Un usuario de la app con sesión, o el cron / el webhook con su token.
  if auth.uid() is null and (p_token is null or not exists (
    select 1 from private.integration_tokens
     where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  )) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;
  if p_key is null or p_key !~ '^[a-z0-9_:]{1,60}$' then raise exception 'Clave inválida'; end if;

  insert into public.integration_runs as r (key, last_ok_at, last_detail, last_error_at, last_error, updated_at)
  values (p_key,
          case when p_ok then now() end, case when p_ok then v_detail end,
          case when not p_ok then now() end, case when not p_ok then v_detail end,
          now())
  on conflict (key) do update
    set last_ok_at    = case when p_ok then now() else r.last_ok_at end,
        last_detail   = case when p_ok then v_detail else r.last_detail end,
        last_error_at = case when not p_ok then now() else r.last_error_at end,
        last_error    = case when not p_ok then v_detail else r.last_error end,
        updated_at    = now();
end;
$$;
revoke all on function public.record_integration_run(text, text, boolean, text) from public;
grant execute on function public.record_integration_run(text, text, boolean, text) to anon, authenticated;

-- Lo último que llegó de Jotform por cada formulario (solo admin).
create or replace function public.jotform_last_activity()
returns table (form text, last_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select 'registro', max(created_at) from public.staff_intake where private.is_admin()
  union all
  select 'dinero', max(created_at) from public.money_requests where private.is_admin()
  union all
  select 'ponchadas', max(created_at) from public.attendance_punches where source = 'jotform' and private.is_admin()
$$;
revoke all on function public.jotform_last_activity() from public, anon;
grant execute on function public.jotform_last_activity() to authenticated;
