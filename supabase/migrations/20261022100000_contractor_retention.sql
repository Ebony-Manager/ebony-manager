-- Retención de garantía (pintores).
--
-- A los pintores se les retiene un % (10%) del trabajo BRUTO que se les
-- acredita, por proyecto, y se les devuelve cuando el proyecto se entrega.
--
--  · contractor_type_settings: el % y desde qué fecha aplica, por tipo de
--    contratista (igual para todos los del tipo — sin reglas por persona).
--  · Cada trabajo / extra a favor de un pintor (fechado desde el inicio)
--    lleva su RETENCIÓN: un movimiento `retencion` que baja el saldo, con
--    `retention_of_entry_id` → el trabajo, y el proyecto del trabajo (o el
--    de su contrato). Se mantiene sola: si el trabajo cambia de monto,
--    fecha o proyecto se recalcula; si se borra, se va con él. Como baja el
--    saldo fuera de un contrato, se descuenta en el próximo pago igual que
--    el material.
--  · DEVOLVER (`release_contractor_retention`): un movimiento `retencion`
--    a favor por lo retenido neto de ese contratista en ese proyecto. Solo
--    con el proyecto entregado (terminado). Se paga en el próximo cierre.
--
-- Redondeo: hacia arriba al centavo (favorece a la empresa).

create table public.contractor_type_settings (
  contractor_type      text         primary key check (contractor_type in ('ebanista', 'pintor')),
  retention_pct        numeric(5,2) not null default 0 check (retention_pct >= 0 and retention_pct < 100),
  -- Trabajos con fecha anterior no llevan retención.
  retention_starts_on  date,
  updated_at           timestamptz  not null default now()
);

insert into public.contractor_type_settings (contractor_type, retention_pct, retention_starts_on) values
  ('ebanista', 0, null),
  ('pintor', 10, '2026-10-14');

alter table public.contractor_type_settings enable row level security;
create policy "contractor_type_settings_module_all" on public.contractor_type_settings
  for all to authenticated using (private.has_module('contratistas')) with check (private.has_module('contratistas'));
create trigger contractor_type_settings_touch_updated_at
  before update on public.contractor_type_settings for each row execute function private.touch_updated_at();
revoke all on public.contractor_type_settings from anon;
grant select, insert, update, delete on public.contractor_type_settings to authenticated;

alter table public.contractor_ledger_entries drop constraint if exists contractor_ledger_entries_category_check;
alter table public.contractor_ledger_entries
  add constraint contractor_ledger_entries_category_check
  check (category in (
    'trabajo', 'bono', 'extra', 'pago', 'prestamo', 'adelanto', 'material', 'gasto_operativo',
    'ajuste', 'herramienta', 'dano', 'indrive', 'otro', 'retencion'
  ));

alter table public.contractor_ledger_entries
  add column retention_of_entry_id uuid references public.contractor_ledger_entries (id) on delete cascade;
create unique index contractor_ledger_entries_retention_of_idx
  on public.contractor_ledger_entries (retention_of_entry_id) where retention_of_entry_id is not null;

comment on column public.contractor_ledger_entries.retention_of_entry_id is
  'Retención de garantía: el trabajo del que sale. La mantiene el trigger contractor_ledger_retention_sync.';

-- ============================================================================
-- La retención de cada trabajo, siempre al día.
-- ============================================================================
create or replace function private.contractor_ledger_retention_sync()
returns trigger
language plpgsql security invoker set search_path = public
as $$
declare
  v_pct numeric;
  v_start date;
  v_amt integer;
  v_proj uuid;
  v_desc text;
begin
  if new.category = 'retencion' then
    return null;
  end if;

  select s.retention_pct, s.retention_starts_on into v_pct, v_start
  from contractors c join contractor_type_settings s on s.contractor_type = c.contractor_type
  where c.id = new.contractor_id;

  if new.direction = 'a_favor' and new.category in ('trabajo', 'extra') and new.amount_cents > 0
     and coalesce(v_pct, 0) > 0 and (v_start is null or new.entry_date >= v_start) then
    v_amt := ceil(new.amount_cents * v_pct / 100.0)::integer;
    v_proj := coalesce(new.project_id, (select k.project_id from contractor_contracts k where k.id = new.contract_id));
    v_desc := format('Retención de garantía %s%%', trim(trailing '.' from trim(trailing '0' from v_pct::text)));
    if exists (select 1 from contractor_ledger_entries where retention_of_entry_id = new.id) then
      update contractor_ledger_entries
      set contractor_id = new.contractor_id, entry_date = new.entry_date, amount_cents = v_amt,
          project_id = v_proj, client_text = new.client_text, description = v_desc
      where retention_of_entry_id = new.id
        and (contractor_id, entry_date, amount_cents, project_id, client_text, description)
            is distinct from (new.contractor_id, new.entry_date, v_amt, v_proj, new.client_text, v_desc);
    else
      insert into contractor_ledger_entries
        (contractor_id, entry_date, category, direction, amount_cents, project_id, client_text, description, retention_of_entry_id)
      values (new.contractor_id, new.entry_date, 'retencion', 'reduce', v_amt, v_proj, new.client_text, v_desc, new.id);
    end if;
  else
    delete from contractor_ledger_entries where retention_of_entry_id = new.id;
  end if;
  return null;
end;
$$;

create trigger contractor_ledger_retention_sync
  after insert or update of contractor_id, entry_date, category, direction, amount_cents, project_id, contract_id, client_text
  on public.contractor_ledger_entries
  for each row execute function private.contractor_ledger_retention_sync();

-- ============================================================================
-- Lo retenido neto de un contratista en un proyecto (null = sin proyecto).
-- ============================================================================
create or replace function public.contractor_retention_held_cents(p_contractor_id uuid, p_project_id uuid)
returns integer
language sql stable security invoker set search_path = public
as $$
  select coalesce(sum(case when direction = 'reduce' then amount_cents else -amount_cents end), 0)::integer
  from contractor_ledger_entries
  where contractor_id = p_contractor_id and category = 'retencion'
    and project_id is not distinct from p_project_id
$$;

-- ============================================================================
-- Devolver la retención de un proyecto entregado.
-- ============================================================================
create or replace function public.release_contractor_retention(p_contractor_id uuid, p_project_id uuid, p_date date)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  v_held integer;
  v_status text;
begin
  if not private.has_module('contratistas') then
    raise exception 'Sin permiso';
  end if;
  if p_project_id is not null then
    select status into v_status from projects where id = p_project_id;
    if not found then
      raise exception 'Proyecto no encontrado';
    end if;
    if v_status <> 'COMPLETED' then
      raise exception 'El proyecto todavía no está entregado';
    end if;
  end if;
  v_held := public.contractor_retention_held_cents(p_contractor_id, p_project_id);
  if v_held <= 0 then
    raise exception 'No hay retención por devolver';
  end if;
  insert into contractor_ledger_entries (contractor_id, entry_date, category, direction, amount_cents, project_id, description)
  values (p_contractor_id, p_date, 'retencion', 'a_favor', v_held, p_project_id, 'Devolución de retención');
  return v_held;
end;
$$;

revoke all on function public.contractor_retention_held_cents(uuid, uuid) from public, anon;
revoke all on function public.release_contractor_retention(uuid, uuid, date) from public, anon;
grant execute on function public.contractor_retention_held_cents(uuid, uuid) to authenticated;
grant execute on function public.release_contractor_retention(uuid, uuid, date) to authenticated;
