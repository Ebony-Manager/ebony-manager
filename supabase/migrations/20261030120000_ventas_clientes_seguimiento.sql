-- Ventas: Clientes y Seguimiento de cotizaciones (reemplaza la lista
-- "Cotizaciones → Prospectos" de ClickUp).
--
-- Clientes: un solo registro con tipo — arquitecto/diseñador o cliente
-- final. Cada oportunidad (y cada proyecto) puede tener los dos a la vez: la
-- arquitecta que trae el trabajo y el cliente final a cuyo nombre a veces se
-- factura. Así se busca a una arquitecta y se ven todos sus proyectos.
--
-- Oportunidad = lo que llega para cotizar: Por cotizar → Cotizando →
-- Enviada → Aprobada / Perdida (con motivo). Sus cotizaciones del cotizador
-- (original, correcciones, extras) cuelgan de ella; la vigente es la última.
-- Al aprobarla se crea el Proyecto con los dos contactos enlazados.
--
-- Lo usa quien tiene el permiso Cotización; todos ven todo.

-- ============================================================================
-- 1. Clientes
-- ============================================================================
create table if not exists public.clients (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null check (btrim(name) <> ''),
  kind        text        not null check (kind in ('arquitecto', 'cliente')),
  phone       text,
  whatsapp    text,
  email       text,
  company     text,
  notes       text,
  active      boolean     not null default true,
  created_by  uuid        default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.clients is 'Clientes: arquitectos/diseñadores y clientes finales (Ventas).';
create index if not exists clients_name_idx on public.clients (lower(name));

-- ============================================================================
-- 2. Oportunidades y su bitácora
-- ============================================================================
create table if not exists public.sales_opportunities (
  id                uuid          primary key default gen_random_uuid(),
  title             text          not null default '',
  designer_id       uuid          references public.clients (id) on delete restrict,
  client_id         uuid          references public.clients (id) on delete restrict,
  location          text,
  stage             text          not null default 'por_cotizar'
                                  check (stage in ('por_cotizar', 'cotizando', 'enviada', 'aprobada', 'perdida')),
  lost_reason       text          check (lost_reason in ('precio', 'tiempo', 'otro_proveedor', 'sin_respuesta', 'otro')),
  lost_note         text,
  received_on       date          not null default private.panama_today(),
  due_on            date,
  next_follow_up    date,
  stage_changed_at  timestamptz   not null default now(),
  sent_on           date,
  closed_on         date,
  owner_id          uuid          references public.profiles (id) on delete set null,
  owner_name        text,
  amount            numeric(14,2) check (amount is null or amount >= 0),
  project_id        uuid          references public.projects (id) on delete set null,
  drive_folder_id   text,
  drive_folder_url  text,
  notes             text,
  created_by        uuid          default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  constraint sales_opportunities_someone check (designer_id is not null or client_id is not null),
  constraint sales_opportunities_lost check ((stage = 'perdida') = (lost_reason is not null))
);
comment on table public.sales_opportunities is 'Seguimiento de cotizaciones: lo que llega para cotizar, hasta aprobado o perdido.';
create index if not exists sales_opportunities_stage_idx on public.sales_opportunities (stage, stage_changed_at desc);
create index if not exists sales_opportunities_designer_idx on public.sales_opportunities (designer_id);
create index if not exists sales_opportunities_client_idx on public.sales_opportunities (client_id);

create table if not exists public.sales_opportunity_notes (
  id               uuid        primary key default gen_random_uuid(),
  opportunity_id   uuid        not null references public.sales_opportunities (id) on delete cascade,
  body             text        not null check (btrim(body) <> ''),
  created_by       uuid        references public.profiles (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now()
);
create index if not exists sales_opportunity_notes_opp_idx on public.sales_opportunity_notes (opportunity_id, created_at desc);

-- Cotizaciones y proyectos enlazados.
alter table public.quotes add column if not exists opportunity_id uuid references public.sales_opportunities (id) on delete set null;
create index if not exists quotes_opportunity_idx on public.quotes (opportunity_id);
alter table public.projects add column if not exists designer_id uuid references public.clients (id) on delete set null;
alter table public.projects add column if not exists client_id uuid references public.clients (id) on delete set null;

-- ============================================================================
-- 3. Triggers
-- ============================================================================
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function private.touch_updated_at();
drop trigger if exists sales_opportunities_touch on public.sales_opportunities;
create trigger sales_opportunities_touch before update on public.sales_opportunities for each row execute function private.touch_updated_at();
drop trigger if exists sales_opportunity_notes_author on public.sales_opportunity_notes;
create trigger sales_opportunity_notes_author before insert on public.sales_opportunity_notes
  for each row execute function private.inventory_stamp_author();

-- Al cambiar de etapa: fecha del cambio, enviada / cerrada, y sin motivo de
-- pérdida si deja de estar perdida. El nombre del responsable se copia del perfil.
create or replace function private.sales_opportunity_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'enviada' and new.sent_on is null then new.sent_on := private.panama_today(); end if;
    if new.stage in ('aprobada', 'perdida') then new.closed_on := coalesce(new.closed_on, private.panama_today());
    else new.closed_on := null; end if;
    if new.stage <> 'perdida' then new.lost_reason := null; new.lost_note := null; end if;
  end if;
  if tg_op = 'INSERT' and new.owner_id is null then new.owner_id := (select auth.uid()); end if;
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    new.owner_name := (select coalesce(nullif(p.full_name, ''), p.email) from public.profiles p where p.id = new.owner_id);
  end if;
  return new;
end;
$$;
drop trigger if exists sales_opportunities_stage on public.sales_opportunities;
create trigger sales_opportunities_stage before insert or update on public.sales_opportunities
  for each row execute function private.sales_opportunity_stage();

-- Una cotización del cotizador marcada Enviada adelanta su oportunidad a
-- Enviada (si todavía estaba antes); Aprobada o Rechazada no la cierran solas.
create or replace function private.quote_advances_opportunity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opportunity_id is not null and new.status = 'ENVIADA' and (tg_op = 'INSERT' or old.status is distinct from 'ENVIADA') then
    update public.sales_opportunities set stage = 'enviada'
     where id = new.opportunity_id and stage in ('por_cotizar', 'cotizando');
  end if;
  return null;
end;
$$;
drop trigger if exists quotes_advance_opportunity on public.quotes;
create trigger quotes_advance_opportunity after insert or update of status on public.quotes
  for each row execute function private.quote_advances_opportunity();

-- ============================================================================
-- 4. Permisos (RLS): todo con Cotización
-- ============================================================================
alter table public.clients enable row level security;
alter table public.sales_opportunities enable row level security;
alter table public.sales_opportunity_notes enable row level security;

drop policy if exists "clients_cotizacion_all" on public.clients;
create policy "clients_cotizacion_all" on public.clients for all to authenticated
  using (private.has_module('cotizacion')) with check (private.has_module('cotizacion'));
-- Quien abre un proyecto ve los nombres de su arquitecto y cliente.
drop policy if exists "clients_proyectos_read" on public.clients;
create policy "clients_proyectos_read" on public.clients for select to authenticated
  using (private.has_module('proyectos') or private.has_module('contratistas'));
drop policy if exists "sales_opportunities_cotizacion_all" on public.sales_opportunities;
create policy "sales_opportunities_cotizacion_all" on public.sales_opportunities for all to authenticated
  using (private.has_module('cotizacion')) with check (private.has_module('cotizacion'));
drop policy if exists "sales_opportunity_notes_cotizacion" on public.sales_opportunity_notes;
create policy "sales_opportunity_notes_cotizacion" on public.sales_opportunity_notes for all to authenticated
  using (private.has_module('cotizacion')) with check (private.has_module('cotizacion'));

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.sales_opportunities to authenticated;
grant select, insert, update, delete on public.sales_opportunity_notes to authenticated;

-- Quiénes pueden llevar una oportunidad (para elegir responsable): los que tienen Cotización.
create or replace function public.sales_people()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(p.full_name, ''), p.email)
    from public.profiles p
   where private.has_module('cotizacion')
     and (p.role = 'admin' or 'cotizacion' = any (coalesce(p.modules, '{}'::text[])))
   order by 2;
$$;
revoke all on function public.sales_people() from public, anon;
grant execute on function public.sales_people() to authenticated;

-- Aprobar: cierra la oportunidad y crea (o enlaza) el proyecto con el
-- arquitecto y el cliente. Corre como dueño: quien cotiza no necesita el
-- permiso de Proyectos para que nazca el proyecto.
create or replace function public.approve_opportunity(p_id uuid, p_project_name text, p_project_id uuid)
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
  update public.sales_opportunities set stage = 'aprobada', project_id = v_project where id = p_id;
  return v_project;
end;
$$;
revoke all on function public.approve_opportunity(uuid, text, uuid) from public, anon;
grant execute on function public.approve_opportunity(uuid, text, uuid) to authenticated;

-- ============================================================================
-- 5. Aviso semanal (lunes) a quien tiene Cotización
-- ============================================================================
insert into public.notification_types (key, module, title, description, default_push, sort_order) values
  ('sales_weekly_follow_up', 'cotizacion', 'Seguimiento semanal de cotizaciones',
   'Los lunes: cotizaciones enviadas sin movimiento en más de 7 días y por cotizar con la entrega vencida o cerca.', true, 150)
on conflict (key) do update set module = excluded.module, title = excluded.title,
  description = excluded.description, default_push = excluded.default_push, sort_order = excluded.sort_order;

-- Lo llama el cron diario (mismo token del resumen del Almacén); solo hace algo los lunes.
create or replace function public.sales_weekly_follow_up(p_token text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.panama_today();
  v_stale integer;
  v_due integer;
  v_n integer;
begin
  if p_token is null or not exists (
    select 1 from private.integration_tokens
     where name = 'almacen_resumen' and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'TOKEN_INVALIDO' using errcode = 'insufficient_privilege';
  end if;
  if extract(isodow from v_today) <> 1 then return 0; end if;
  select count(*) into v_stale from public.sales_opportunities
   where stage = 'enviada' and stage_changed_at < now() - interval '7 days'
     and (next_follow_up is null or next_follow_up <= v_today);
  select count(*) into v_due from public.sales_opportunities
   where stage in ('por_cotizar', 'cotizando') and due_on is not null and due_on <= v_today + 3;
  if v_stale + v_due = 0 then return 0; end if;
  insert into public.app_notifications (kind, type_key, title, body, href, dedupe_key)
  values ('sales_weekly_follow_up', 'sales_weekly_follow_up', 'Seguimiento de cotizaciones',
          concat_ws(' · ',
            case when v_stale > 0 then v_stale || case when v_stale = 1 then ' enviada sin respuesta hace más de 7 días' else ' enviadas sin respuesta hace más de 7 días' end end,
            case when v_due > 0 then v_due || ' por cotizar con entrega vencida o cerca' end),
          '/cotizacion/seguimiento', 'sales_weekly_follow_up:' || v_today)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.sales_weekly_follow_up(text) from public;
grant execute on function public.sales_weekly_follow_up(text) to anon, authenticated;
