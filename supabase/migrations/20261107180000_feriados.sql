-- Settings → Feriados.
--
-- La lista sale de feriados.io (sincronización diaria desde el cron) más los
-- días que agregue el admin a mano. En asistencia solo cuentan los
-- CONFIRMADOS: un feriado confirmado sin marcaciones no es falta, y quien
-- marca ese día queda "Trabajó en feriado" para que el admin lo revise (la app
-- no calcula sola el recargo).
--
-- A favor de la empresa, lo que trae feriados.io entra "por confirmar" salvo
-- en la primera carga de cada año, y aun ahí solo los de descanso obligatorio
-- para el sector privado (feriados.io marca los demás con mandatory_rest
-- false, ej. 2 y 4 de noviembre). Un día nuevo o movido después (puente,
-- decreto, traslado) queda por confirmar y le llega un aviso al admin. Si un
-- día deja de aparecer en feriados.io, también vuelve a por confirmar.
--
-- Todos leen; solo el admin escribe. El cron escribe con sync_holidays y el
-- mismo token del resumen diario del Almacén (sin service_role).

create table if not exists public.holidays (
  date            date primary key,
  name            text not null check (btrim(name) <> ''),
  source          text not null default 'manual' check (source in ('manual', 'feriados_io')),
  status          text not null default 'confirmado' check (status in ('confirmado', 'pendiente', 'descartado')),
  -- Lo que dice feriados.io (null en los manuales).
  mandatory_rest  boolean,
  irrenunciable   boolean,
  original_date   date,
  missing_from_source boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  decided_by      uuid references auth.users (id) on delete set null,
  decided_at      timestamptz
);
alter table public.holidays enable row level security;
drop policy if exists "holidays_read" on public.holidays;
create policy "holidays_read" on public.holidays for select to authenticated using (true);
drop policy if exists "holidays_admin_write" on public.holidays;
create policy "holidays_admin_write" on public.holidays for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Aviso solo para admins (ningún usuario tiene el módulo 'admin').
insert into public.notification_types (key, module, title, description, default_push, sort_order) values
  ('holiday_pending', 'admin', 'Feriado por confirmar',
   'feriados.io trajo un día feriado nuevo o cambiado (puente, decreto, traslado). No cuenta en asistencia hasta que lo confirmes.', true, 160)
on conflict (key) do update set module = excluded.module, title = excluded.title,
  description = excluded.description, default_push = excluded.default_push, sort_order = excluded.sort_order;

-- Guarda lo que trajo feriados.io para un año. p_items: [{date, name,
-- mandatory_rest?, irrenunciable?, original_date?}]. Devuelve cuántos quedaron
-- por confirmar en esta pasada.
create or replace function public.sync_holidays(p_token text, p_year integer, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first boolean;
  v_pending integer := 0;
  v_n integer;
  it jsonb;
  v_date date;
  v_name text;
  v_mand boolean;
  v_irr boolean;
  v_orig date;
  v_inserted boolean;
  v_status text;
  v_dates date[] := '{}';
  v_new_pending text[] := '{}';
begin
  if not private.is_admin() and (p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'almacen_resumen' and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  )) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Datos inválidos';
  end if;

  v_first := not exists (
    select 1 from public.holidays where source = 'feriados_io' and extract(year from date) = p_year
  );

  for it in select * from jsonb_array_elements(p_items) loop
    v_date := (it ->> 'date')::date;
    v_name := nullif(btrim(it ->> 'name'), '');
    if v_date is null or v_name is null or extract(year from v_date) <> p_year then continue; end if;
    v_mand := (it ->> 'mandatory_rest')::boolean;
    v_irr := (it ->> 'irrenunciable')::boolean;
    v_orig := nullif(it ->> 'original_date', '')::date;
    v_dates := v_dates || v_date;
    v_inserted := null;
    v_status := null;

    insert into public.holidays (date, name, source, status, mandatory_rest, irrenunciable, original_date)
    values (v_date, v_name, 'feriados_io',
            case when v_first and coalesce(v_mand, true) then 'confirmado' else 'pendiente' end,
            v_mand, v_irr, v_orig)
    on conflict (date) do update
      set mandatory_rest = excluded.mandatory_rest,
          irrenunciable = excluded.irrenunciable,
          original_date = excluded.original_date,
          -- Vuelve a aparecer: si se había marcado por desaparecer, queda por confirmar.
          status = case when public.holidays.missing_from_source and public.holidays.status = 'confirmado' then 'pendiente' else public.holidays.status end,
          missing_from_source = false,
          updated_at = now()
      where public.holidays.source = 'feriados_io'
    returning (xmax = 0), status into v_inserted, v_status;
    -- Recién insertado y por confirmar: va al aviso.
    if coalesce(v_inserted, false) and v_status = 'pendiente' then
      v_new_pending := v_new_pending || to_char(v_date, 'DD/MM/YYYY');
    end if;
  end loop;

  -- Los de feriados.io de ese año que ya no aparecen: por confirmar (no cuentan).
  update public.holidays
     set missing_from_source = true,
         status = case when status = 'confirmado' then 'pendiente' else status end,
         updated_at = now()
   where source = 'feriados_io' and extract(year from date) = p_year
     and not (date = any (v_dates)) and not missing_from_source;
  get diagnostics v_n = row_count;

  select count(*) into v_pending from public.holidays
   where status = 'pendiente' and extract(year from date) = p_year;

  if cardinality(v_new_pending) > 0 or v_n > 0 then
    insert into public.app_notifications (kind, type_key, title, body, href, dedupe_key)
    values ('holiday_pending', 'holiday_pending', 'Feriados por confirmar',
            case when cardinality(v_new_pending) > 0 then 'Nuevos en feriados.io: ' || array_to_string(v_new_pending, ', ') || '. ' else '' end
              || case when v_n > 0 then v_n || ' ya no aparece(n) en feriados.io. ' else '' end
              || 'No cuentan en asistencia hasta que los confirmes.',
            '/settings/feriados', 'holiday_pending:' || p_year || ':' || md5(array_to_string(v_new_pending, ',') || ':' || v_n || ':' || now()::date))
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return v_pending;
end;
$$;
revoke all on function public.sync_holidays(text, integer, jsonb) from public;
grant execute on function public.sync_holidays(text, integer, jsonb) to anon, authenticated;
