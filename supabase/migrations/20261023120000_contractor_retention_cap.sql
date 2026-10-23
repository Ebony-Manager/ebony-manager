-- Retención de garantía (pintores), versión 2: es un TOPE, no un descuento.
--
-- En un contrato de pintor no se puede abonar más del valor menos la
-- retención (10% del trabajo bruto desde el 14-oct-2026) mientras su
-- proyecto no esté terminado. El pago sigue siendo el monto que se paga;
-- lo retenido queda pendiente en el contrato (no se ve pagado al 100%) y
-- se puede pagar en cuanto el proyecto se marca terminado. No hay
-- movimientos de retención ni "devolver".
--
-- Reemplaza 20261022100000_contractor_retention.sql: se quitan su trigger,
-- sus funciones, la columna retention_of_entry_id y la categoría
-- 'retencion' (no llegó a haber ningún movimiento así). Se conservan
-- contractor_type_settings (el % y la fecha de inicio por tipo).

drop trigger if exists contractor_ledger_retention_sync on public.contractor_ledger_entries;
drop function if exists private.contractor_ledger_retention_sync();
drop function if exists public.release_contractor_retention(uuid, uuid, date);
drop function if exists public.contractor_retention_held_cents(uuid, uuid);
drop index if exists public.contractor_ledger_entries_retention_of_idx;
alter table public.contractor_ledger_entries drop column if exists retention_of_entry_id;

alter table public.contractor_ledger_entries drop constraint if exists contractor_ledger_entries_category_check;
alter table public.contractor_ledger_entries
  add constraint contractor_ledger_entries_category_check
  check (category in (
    'trabajo', 'bono', 'extra', 'pago', 'prestamo', 'adelanto', 'material', 'gasto_operativo',
    'ajuste', 'herramienta', 'dano', 'indrive', 'otro'
  ));

-- ============================================================================
-- % de retención que aplica a un trabajo de ese contratista en esa fecha.
-- ============================================================================
create or replace function public.contractor_retention_pct(p_contractor_id uuid, p_date date)
returns numeric
language sql stable security invoker set search_path = public
as $$
  select coalesce((
    select s.retention_pct
    from contractors c join contractor_type_settings s on s.contractor_type = c.contractor_type
    where c.id = p_contractor_id
      and (s.retention_starts_on is null or p_date >= s.retention_starts_on)
  ), 0)
$$;

-- ============================================================================
-- Lo retenido de un contrato: el % de cada trabajo / extra (redondeado
-- hacia arriba al centavo, a favor de la empresa) mientras el proyecto no
-- esté terminado. Con el proyecto terminado es 0.
-- ============================================================================
create or replace function public.contractor_contract_retention_cents(p_contract uuid)
returns integer
language sql stable security invoker set search_path = public
as $$
  select case when p.status = 'COMPLETED' then 0 else coalesce((
    select sum(ceil(e.amount_cents * public.contractor_retention_pct(e.contractor_id, e.entry_date) / 100.0))
    from contractor_ledger_entries e
    where e.contract_id = k.id and e.direction = 'a_favor' and e.category in ('trabajo', 'extra')
      and not e.ebony_absorbs_material
  ), 0)::integer end
  from contractor_contracts k join projects p on p.id = k.project_id
  where k.id = p_contract
$$;

revoke all on function public.contractor_retention_pct(uuid, date) from public, anon;
revoke all on function public.contractor_contract_retention_cents(uuid) from public, anon;
grant execute on function public.contractor_retention_pct(uuid, date) to authenticated;
grant execute on function public.contractor_contract_retention_cents(uuid) to authenticated;

-- ============================================================================
-- Registrar un pago: un abono a un contrato no puede pasar lo pendiente
-- menos lo retenido. Lo demás, igual que en 20261022080000.
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
  v_retention integer;
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
  p_period_id uuid := nullif(current_setting('app.pay_period_id', true), '')::uuid;
begin
  if not private.has_module('contratistas') then
    raise exception 'Sin permiso';
  end if;
  if v_loose < 0 then
    raise exception 'Monto inválido';
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_cid := (v_line ->> 'contract_id')::uuid;
    v_amt := (v_line ->> 'amount_cents')::integer;
    if v_amt is null or v_amt <= 0 then
      continue;
    end if;
    if v_cid = any(v_contracts) then
      raise exception 'Contrato repetido';
    end if;
    select public.contractor_contract_pending_cents(k.id), public.contractor_contract_retention_cents(k.id)
      into v_pending, v_retention
    from contractor_contracts k
    where k.id = v_cid and k.contractor_id = p_contractor_id;
    if not found then
      raise exception 'Contrato no encontrado';
    end if;
    if v_amt > v_pending then
      raise exception 'El abono pasa lo que le falta al contrato';
    end if;
    if v_amt > v_pending - v_retention then
      raise exception 'El abono pasa lo que se puede pagar: el resto es retención de garantía y se paga al terminar el proyecto';
    end if;
    v_contracts := v_contracts || v_cid;
    v_credits := v_credits || null::uuid;
    v_needs := v_needs || v_amt;
    v_total := v_total + v_amt;
  end loop;

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
      insert into contractor_payment_allocations
        (contractor_id, source_entry_id, contract_id, credit_entry_id, amount_cents, pay_period_id)
      values (p_contractor_id, s.id, v_contracts[i], v_credits[i], v_take, p_period_id);
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

-- ============================================================================
-- Cierre de saldo: vuelve a la versión de 20261022090000 (sin la parte de
-- movimientos de retención, que ya no existen).
-- ============================================================================
create or replace function public.zero_contractor_balance(p_contractor_id uuid, p_date date, p_note text)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  v_bal integer;
  s record;
  t record;
  v_rem integer;
  v_take integer;
begin
  if not private.has_module('contratistas') then
    raise exception 'Sin permiso';
  end if;

  select coalesce(sum(case when direction = 'a_favor' then amount_cents else -amount_cents end), 0)::integer
    into v_bal
  from contractor_ledger_entries
  where contractor_id = p_contractor_id and not ebony_absorbs_material
    and (loan_id is null or entry_date <= p_date);

  if v_bal <> 0 then
    insert into contractor_ledger_entries (contractor_id, entry_date, category, direction, amount_cents, description, notes)
    values (p_contractor_id, p_date, 'ajuste', case when v_bal > 0 then 'reduce' else 'a_favor' end, abs(v_bal),
            'Cierre de saldo', nullif(trim(coalesce(p_note, '')), ''));
  end if;

  -- Reparto: lo que baja el saldo (y no está repartido) cubre lo pendiente,
  -- de lo más viejo a lo más nuevo.
  for s in
    select e.id,
           (e.amount_cents - coalesce((select sum(a.amount_cents) from contractor_payment_allocations a
                                       where a.source_entry_id = e.id), 0))::integer as rem
    from contractor_ledger_entries e
    where e.contractor_id = p_contractor_id and e.direction = 'reduce' and e.contract_id is null
      and not e.ebony_absorbs_material and e.entry_date <= p_date
    order by e.entry_date, e.created_at
  loop
    continue when s.rem <= 0;
    v_rem := s.rem;
    for t in
      select contract_id, credit_entry_id, rem from (
        select k.id as contract_id, null::uuid as credit_entry_id, k.contract_date as d, null::timestamptz as ca,
               public.contractor_contract_pending_cents(k.id) as rem
        from contractor_contracts k
        where k.contractor_id = p_contractor_id
        union all
        select null::uuid, e.id, e.entry_date, e.created_at,
               (e.amount_cents - coalesce((select sum(a.amount_cents) from contractor_payment_allocations a
                                           where a.credit_entry_id = e.id), 0))::integer
        from contractor_ledger_entries e
        where e.contractor_id = p_contractor_id and e.direction = 'a_favor' and e.contract_id is null
          and not e.ebony_absorbs_material
      ) z
      where rem > 0
      order by d, ca nulls first
    loop
      exit when v_rem <= 0;
      v_take := least(v_rem, t.rem);
      insert into contractor_payment_allocations (contractor_id, source_entry_id, contract_id, credit_entry_id, amount_cents)
      values (p_contractor_id, s.id, t.contract_id, t.credit_entry_id, v_take);
      v_rem := v_rem - v_take;
    end loop;
  end loop;

  update contractor_contracts set status = 'COMPLETED' where contractor_id = p_contractor_id and status = 'ACTIVE';
  return v_bal;
end;
$$;

revoke all on function public.zero_contractor_balance(uuid, date, text) from public, anon;
grant execute on function public.zero_contractor_balance(uuid, date, text) to authenticated;
