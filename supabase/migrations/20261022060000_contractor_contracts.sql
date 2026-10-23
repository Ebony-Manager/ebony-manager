-- Contratos de contratistas.
--
-- El proyecto (`projects`) es la obra; el contrato es lo que se le
-- encarga a UN contratista dentro de ese proyecto (un juego de planos):
-- sus piezas con medidas definen el valor acordado. Un contratista puede
-- tener varios contratos, en el mismo proyecto o en otros.
--
--  · VALOR del contrato = los movimientos del estado de cuenta con
--    `contract_id` (trabajo / extra / bono / ajuste), con signo. Las
--    piezas viven en `contractor_ledger_entry_items` de esos movimientos,
--    igual que antes; se pueden editar en todo momento.
--
--  · ABONOS: todo lo que baja el saldo sin ser parte de un contrato
--    (pago, cuota de préstamo, adelanto, material, daño…) es una FUENTE;
--    `contractor_payment_allocations` reparte cada fuente entre contratos
--    o entre créditos sueltos (lo acreditado sin contrato, p. ej. la
--    historia vieja o un bono). Lo que una fuente no tiene repartido queda
--    "a cuenta" y se aplica primero en el próximo pago.
--
--  Siempre cuadra: saldo = Σ lo que falta de los contratos
--                        + Σ lo que falta de los créditos sueltos
--                        − Σ lo que está a cuenta sin repartir.
--
-- Nada de esto cambia el saldo de nadie: el saldo sigue siendo la suma
-- del estado de cuenta.

create table public.contractor_contracts (
  id             uuid        primary key default gen_random_uuid(),
  contractor_id  uuid        not null references public.contractors (id) on delete cascade,
  -- Borrar un proyecto con contratos no se permite: primero se borran o
  -- mueven sus contratos.
  project_id     uuid        not null references public.projects (id) on delete restrict,
  name           text        not null check (length(trim(name)) > 0),
  contract_date  date        not null default current_date,
  status         text        not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED')),
  scope          text,
  payment_terms  text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.contractor_contracts is
  'Contrato de un contratista dentro de un proyecto. Su valor = movimientos con contract_id; sus abonos = contractor_payment_allocations.';

create index contractor_contracts_contractor_idx on public.contractor_contracts (contractor_id);
create index contractor_contracts_project_idx on public.contractor_contracts (project_id);

alter table public.contractor_ledger_entries
  add column contract_id uuid references public.contractor_contracts (id) on delete set null;
create index contractor_ledger_entries_contract_idx on public.contractor_ledger_entries (contract_id);

create table public.contractor_payment_allocations (
  id               uuid        primary key default gen_random_uuid(),
  -- Denormalizado para leer los abonos de un contratista sin joins. Sin FK
  -- a `contractors` a propósito (la fila se va en cascada con su fuente).
  contractor_id    uuid        not null,
  -- Lo que baja el saldo (pago, cuota, material…).
  source_entry_id  uuid        not null references public.contractor_ledger_entries (id) on delete cascade,
  -- A qué se abona: un contrato o un crédito suelto (uno de los dos).
  contract_id      uuid        references public.contractor_contracts (id) on delete cascade,
  credit_entry_id  uuid        references public.contractor_ledger_entries (id) on delete cascade,
  amount_cents     integer     not null check (amount_cents > 0),
  created_at       timestamptz not null default now(),
  constraint contractor_payment_allocations_one_target check (num_nonnulls(contract_id, credit_entry_id) = 1)
);

comment on table public.contractor_payment_allocations is
  'Cuánto de cada movimiento que baja el saldo se abonó a cada contrato (o crédito suelto).';

create index contractor_payment_allocations_contractor_idx on public.contractor_payment_allocations (contractor_id);
create index contractor_payment_allocations_source_idx on public.contractor_payment_allocations (source_entry_id);
create index contractor_payment_allocations_contract_idx on public.contractor_payment_allocations (contract_id);
create index contractor_payment_allocations_credit_idx on public.contractor_payment_allocations (credit_entry_id);

alter table public.contractor_contracts enable row level security;
alter table public.contractor_payment_allocations enable row level security;

create policy "contractor_contracts_module_all" on public.contractor_contracts
  for all to authenticated
  using (private.has_module('contratistas'))
  with check (private.has_module('contratistas'));

create policy "contractor_payment_allocations_module_all" on public.contractor_payment_allocations
  for all to authenticated
  using (private.has_module('contratistas'))
  with check (private.has_module('contratistas'));

create trigger contractor_contracts_touch_updated_at
  before update on public.contractor_contracts
  for each row execute function private.touch_updated_at();

revoke all on public.contractor_contracts from anon;
revoke all on public.contractor_payment_allocations from anon;
grant select, insert, update, delete on public.contractor_contracts to authenticated;
grant select, insert, update, delete on public.contractor_payment_allocations to authenticated;

-- ============================================================================
-- Valor y lo que falta de un contrato.
-- ============================================================================
create or replace function public.contractor_contract_value_cents(p_contract uuid)
returns integer
language sql stable security invoker set search_path = public
as $$
  select coalesce(sum(case when direction = 'a_favor' then amount_cents else -amount_cents end), 0)::integer
  from contractor_ledger_entries
  where contract_id = p_contract and not ebony_absorbs_material
$$;

create or replace function public.contractor_contract_pending_cents(p_contract uuid)
returns integer
language sql stable security invoker set search_path = public
as $$
  select public.contractor_contract_value_cents(p_contract)
       - coalesce((select sum(amount_cents) from contractor_payment_allocations where contract_id = p_contract), 0)::integer
$$;

-- ============================================================================
-- Integridad: si un movimiento cambia (monto, sentido, contrato) o un
-- contrato baja de valor, se recortan los abonos que ya no caben. Lo
-- recortado vuelve a quedar "a cuenta" y se aplica en el próximo pago.
-- ============================================================================
create or replace function private.trim_allocations(p_column text, p_id uuid, p_max integer)
returns void
language plpgsql security invoker set search_path = public
as $$
declare
  v_excess integer;
  a record;
begin
  execute format('select coalesce(sum(amount_cents), 0) from contractor_payment_allocations where %I = $1', p_column)
    into v_excess using p_id;
  v_excess := v_excess - greatest(p_max, 0);
  if v_excess <= 0 then return; end if;
  for a in execute format(
    'select id, amount_cents from contractor_payment_allocations where %I = $1 order by created_at desc, id desc', p_column
  ) using p_id loop
    exit when v_excess <= 0;
    if a.amount_cents <= v_excess then
      delete from contractor_payment_allocations where id = a.id;
      v_excess := v_excess - a.amount_cents;
    else
      update contractor_payment_allocations set amount_cents = amount_cents - v_excess where id = a.id;
      v_excess := 0;
    end if;
  end loop;
end;
$$;

create or replace function private.contractor_ledger_allocations_fix()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'INSERT') then
    -- Como fuente: solo un movimiento que baja el saldo, fuera de un contrato.
    if new.direction <> 'reduce' or new.contract_id is not null or new.ebony_absorbs_material then
      delete from contractor_payment_allocations where source_entry_id = new.id;
    else
      perform private.trim_allocations('source_entry_id', new.id, new.amount_cents);
    end if;
    -- Como crédito suelto: solo un movimiento a favor, fuera de un contrato.
    if new.direction <> 'a_favor' or new.contract_id is not null or new.ebony_absorbs_material then
      delete from contractor_payment_allocations where credit_entry_id = new.id;
    else
      perform private.trim_allocations('credit_entry_id', new.id, new.amount_cents);
    end if;
    if new.contract_id is not null then
      perform private.trim_allocations('contract_id', new.contract_id,
        public.contractor_contract_value_cents(new.contract_id));
    end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.contract_id is not null
     and (tg_op = 'DELETE' or old.contract_id is distinct from new.contract_id) then
    perform private.trim_allocations('contract_id', old.contract_id,
      public.contractor_contract_value_cents(old.contract_id));
  end if;
  return null;
end;
$$;

create trigger contractor_ledger_allocations_fix
  after insert or update or delete on public.contractor_ledger_entries
  for each row execute function private.contractor_ledger_allocations_fix();

-- ============================================================================
-- Registrar un pago repartido entre contratos (y lo pendiente sin contrato).
-- Primero se aplica lo que está a cuenta (cuotas de préstamo, adelantos,
-- material… con fecha hasta la del pago); el resto sale en efectivo como un
-- movimiento "pago". Todo en una transacción.
--   p_lines:       [{ "contract_id": uuid, "amount_cents": int }, …]
--   p_loose_cents: abono a lo acreditado sin contrato (lo más viejo primero).
-- ============================================================================
create or replace function public.register_contractor_payment(
  p_contractor_id uuid,
  p_date date,
  p_lines jsonb,
  p_loose_cents integer,
  p_notes text
)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_line jsonb;
  v_cid uuid;
  v_amt integer;
  v_pending integer;
  v_total integer := 0;
  v_loose integer := coalesce(p_loose_cents, 0);
  v_loose_pending integer;
  v_available integer;
  v_deduct integer;
  v_cash integer;
  v_entry uuid;
  v_contracts uuid[] := '{}';
  v_credits uuid[] := '{}';
  v_needs integer[] := '{}';
  v_n integer;
  i integer := 1;
  s record;
  c record;
  v_rem integer;
  v_take integer;
begin
  if not private.has_module('contratistas') then
    raise exception 'Sin permiso';
  end if;
  if v_loose < 0 then
    raise exception 'Monto inválido';
  end if;

  -- 1. Destinos: contratos (en el orden en que vienen)…
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_cid := (v_line ->> 'contract_id')::uuid;
    v_amt := (v_line ->> 'amount_cents')::integer;
    if v_amt is null or v_amt <= 0 then
      continue;
    end if;
    if v_cid = any(v_contracts) then
      raise exception 'Contrato repetido';
    end if;
    select public.contractor_contract_pending_cents(k.id) into v_pending
    from contractor_contracts k
    where k.id = v_cid and k.contractor_id = p_contractor_id;
    if not found then
      raise exception 'Contrato no encontrado';
    end if;
    if v_amt > v_pending then
      raise exception 'El abono pasa lo que le falta al contrato';
    end if;
    v_contracts := v_contracts || v_cid;
    v_credits := v_credits || null::uuid;
    v_needs := v_needs || v_amt;
    v_total := v_total + v_amt;
  end loop;

  -- … y lo acreditado sin contrato, lo más viejo primero.
  if v_loose > 0 then
    v_loose_pending := 0;
    for c in
      select e.id, (e.amount_cents - coalesce((select sum(a.amount_cents) from contractor_payment_allocations a
                                               where a.credit_entry_id = e.id), 0))::integer as rem
      from contractor_ledger_entries e
      where e.contractor_id = p_contractor_id and e.direction = 'a_favor' and e.contract_id is null
        and not e.ebony_absorbs_material
      order by e.entry_date, e.created_at
    loop
      continue when c.rem <= 0;
      exit when v_loose_pending >= v_loose;
      v_take := least(c.rem, v_loose - v_loose_pending);
      v_contracts := v_contracts || null::uuid;
      v_credits := v_credits || c.id;
      v_needs := v_needs || v_take;
      v_loose_pending := v_loose_pending + v_take;
    end loop;
    if v_loose_pending < v_loose then
      raise exception 'El abono sin contrato pasa lo que se le debe sin contrato';
    end if;
    v_total := v_total + v_loose;
  end if;

  if v_total <= 0 then
    raise exception 'No hay nada que abonar';
  end if;

  -- 2. Lo que ya está a cuenta se aplica primero; el resto sale en efectivo.
  select coalesce(sum(rem), 0)::integer into v_available
  from (
    select e.amount_cents - coalesce((select sum(a.amount_cents) from contractor_payment_allocations a
                                      where a.source_entry_id = e.id), 0) as rem
    from contractor_ledger_entries e
    where e.contractor_id = p_contractor_id and e.direction = 'reduce' and e.contract_id is null
      and not e.ebony_absorbs_material and e.entry_date <= p_date
  ) x
  where rem > 0;
  v_deduct := least(v_available, v_total);
  v_cash := v_total - v_deduct;

  if v_cash > 0 then
    insert into contractor_ledger_entries (contractor_id, entry_date, category, direction, amount_cents, description, notes)
    values (p_contractor_id, p_date, 'pago', 'reduce', v_cash, 'Abono a contratos', nullif(trim(coalesce(p_notes, '')), ''))
    returning id into v_entry;
  end if;

  -- 3. Reparto: fuentes en orden de fecha (el pago nuevo queda de último).
  v_n := coalesce(array_length(v_needs, 1), 0);
  for s in
    select e.id,
           (e.amount_cents - coalesce((select sum(a.amount_cents) from contractor_payment_allocations a
                                       where a.source_entry_id = e.id), 0))::integer as rem
    from contractor_ledger_entries e
    where e.contractor_id = p_contractor_id and e.direction = 'reduce' and e.contract_id is null
      and not e.ebony_absorbs_material and e.entry_date <= p_date
    order by (e.id = v_entry), e.entry_date, e.created_at
  loop
    exit when i > v_n;
    v_rem := s.rem;
    while v_rem > 0 and i <= v_n loop
      v_take := least(v_rem, v_needs[i]);
      insert into contractor_payment_allocations (contractor_id, source_entry_id, contract_id, credit_entry_id, amount_cents)
      values (p_contractor_id, s.id, v_contracts[i], v_credits[i], v_take);
      v_rem := v_rem - v_take;
      v_needs[i] := v_needs[i] - v_take;
      if v_needs[i] = 0 then
        i := i + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('payment_entry_id', v_entry, 'cash_cents', v_cash, 'deducted_cents', v_deduct);
end;
$$;

revoke all on function public.register_contractor_payment(uuid, date, jsonb, integer, text) from public, anon;
grant execute on function public.register_contractor_payment(uuid, date, jsonb, integer, text) to authenticated;
grant execute on function public.contractor_contract_value_cents(uuid) to authenticated;
grant execute on function public.contractor_contract_pending_cents(uuid) to authenticated;
-- La función del trigger corre con los permisos de quien edita (la RLS
-- aplica); necesita poder llamar al recorte.
grant execute on function private.trim_allocations(text, uuid, integer) to authenticated;
