-- Cierre quincenal de contratistas (la "Quincena" de empleados, homologada).
--
--  · contractor_pay_periods: una por quincena; borrador → pagada.
--  · contractor_pay_lines:   el BORRADOR — cuánto se le abona a cada
--    contrato de cada contratista (contract_id null = "sin contrato").
--    Mientras es borrador no mueve nada.
--  · Marcar pagada (`close_contractor_pay_period`) registra, por cada
--    contratista, su pago con `register_contractor_payment` a la fecha de
--    pago de la quincena (15 o fin de mes): primero se aplica lo que está a
--    cuenta (cuotas, adelantos, descuentos…) y el resto es el efectivo.
--    Todo en una transacción; queda en contractor_pay_results.
--  · Reabrir (`reopen_contractor_pay_period`) deshace exactamente eso: borra
--    los pagos y los abonos de esa quincena y la deja en borrador.

create table public.contractor_pay_periods (
  id          uuid        primary key default gen_random_uuid(),
  year        integer     not null,
  month       integer     not null check (month between 1 and 12),
  half        integer     not null check (half in (1, 2)),
  pay_date    date        not null,
  status      text        not null default 'draft' check (status in ('draft', 'paid')),
  paid_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (year, month, half)
);

create table public.contractor_pay_lines (
  id             uuid        primary key default gen_random_uuid(),
  period_id      uuid        not null references public.contractor_pay_periods (id) on delete cascade,
  contractor_id  uuid        not null references public.contractors (id) on delete cascade,
  -- null = abono a lo acreditado sin contrato.
  contract_id    uuid        references public.contractor_contracts (id) on delete cascade,
  amount_cents   integer     not null check (amount_cents > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint contractor_pay_lines_unique unique nulls not distinct (period_id, contractor_id, contract_id)
);
create index contractor_pay_lines_period_idx on public.contractor_pay_lines (period_id);

create table public.contractor_pay_results (
  period_id         uuid    not null references public.contractor_pay_periods (id) on delete cascade,
  contractor_id     uuid    not null references public.contractors (id) on delete cascade,
  payment_entry_id  uuid    references public.contractor_ledger_entries (id) on delete set null,
  abonos_cents      integer not null,
  deducted_cents    integer not null,
  cash_cents        integer not null,
  primary key (period_id, contractor_id)
);

-- Qué abonos salieron de qué quincena (para poder reabrirla).
alter table public.contractor_payment_allocations
  add column pay_period_id uuid references public.contractor_pay_periods (id) on delete set null;
create index contractor_payment_allocations_period_idx on public.contractor_payment_allocations (pay_period_id);

alter table public.contractor_pay_periods enable row level security;
alter table public.contractor_pay_lines enable row level security;
alter table public.contractor_pay_results enable row level security;

create policy "contractor_pay_periods_module_all" on public.contractor_pay_periods
  for all to authenticated using (private.has_module('contratistas')) with check (private.has_module('contratistas'));
create policy "contractor_pay_lines_module_all" on public.contractor_pay_lines
  for all to authenticated using (private.has_module('contratistas')) with check (private.has_module('contratistas'));
create policy "contractor_pay_results_module_all" on public.contractor_pay_results
  for all to authenticated using (private.has_module('contratistas')) with check (private.has_module('contratistas'));

create trigger contractor_pay_periods_touch_updated_at
  before update on public.contractor_pay_periods for each row execute function private.touch_updated_at();
create trigger contractor_pay_lines_touch_updated_at
  before update on public.contractor_pay_lines for each row execute function private.touch_updated_at();

revoke all on public.contractor_pay_periods, public.contractor_pay_lines, public.contractor_pay_results from anon;
grant select, insert, update, delete on public.contractor_pay_periods, public.contractor_pay_lines, public.contractor_pay_results
  to authenticated;

-- ============================================================================
-- register_contractor_payment: ahora anota de qué quincena sale cada abono
-- (la toma de `app.pay_period_id`, que fija el cierre dentro de su
-- transacción; un pago suelto desde la ficha no la tiene).
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
-- Marcar pagada / reabrir.
-- ============================================================================
create function public.close_contractor_pay_period(p_period uuid)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  per record;
  c record;
  v_lines jsonb;
  v_loose integer;
  v_abonos integer;
  r jsonb;
  v_note text;
  v_count integer := 0;
  v_cash integer := 0;
begin
  if not private.has_module('contratistas') then
    raise exception 'Sin permiso';
  end if;
  select * into per from contractor_pay_periods where id = p_period for update;
  if not found then
    raise exception 'Quincena no encontrada';
  end if;
  if per.status = 'paid' then
    raise exception 'Esta quincena ya está pagada';
  end if;
  v_note := format('Quincena %s %s-%s', case when per.half = 1 then '1ra' else '2da' end, lpad(per.month::text, 2, '0'), per.year);

  for c in
    select l.contractor_id, k.name
    from contractor_pay_lines l join contractors k on k.id = l.contractor_id
    where l.period_id = p_period
    group by l.contractor_id, k.name
    order by k.name
  loop
    select coalesce(jsonb_agg(jsonb_build_object('contract_id', contract_id, 'amount_cents', amount_cents))
                      filter (where contract_id is not null), '[]'::jsonb),
           coalesce(sum(amount_cents) filter (where contract_id is null), 0)::integer,
           coalesce(sum(amount_cents), 0)::integer
      into v_lines, v_loose, v_abonos
    from contractor_pay_lines
    where period_id = p_period and contractor_id = c.contractor_id;

    perform set_config('app.pay_period_id', p_period::text, true);
    begin
      r := public.register_contractor_payment(c.contractor_id, per.pay_date, v_lines, v_loose, v_note);
    exception when others then
      raise exception '%: %', c.name, sqlerrm;
    end;

    insert into contractor_pay_results (period_id, contractor_id, payment_entry_id, abonos_cents, deducted_cents, cash_cents)
    values (p_period, c.contractor_id, (r ->> 'payment_entry_id')::uuid, v_abonos,
            (r ->> 'deducted_cents')::integer, (r ->> 'cash_cents')::integer);
    v_count := v_count + 1;
    v_cash := v_cash + (r ->> 'cash_cents')::integer;
  end loop;

  perform set_config('app.pay_period_id', '', true);
  update contractor_pay_periods set status = 'paid', paid_at = now() where id = p_period;
  return jsonb_build_object('contractors', v_count, 'cash_cents', v_cash);
end;
$$;

create function public.reopen_contractor_pay_period(p_period uuid)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not private.has_module('contratistas') then
    raise exception 'Sin permiso';
  end if;
  delete from contractor_payment_allocations where pay_period_id = p_period;
  delete from contractor_ledger_entries
  where id in (select payment_entry_id from contractor_pay_results where period_id = p_period and payment_entry_id is not null);
  delete from contractor_pay_results where period_id = p_period;
  update contractor_pay_periods set status = 'draft', paid_at = null where id = p_period;
end;
$$;

revoke all on function public.close_contractor_pay_period(uuid) from public, anon;
revoke all on function public.reopen_contractor_pay_period(uuid) from public, anon;
grant execute on function public.close_contractor_pay_period(uuid) to authenticated;
grant execute on function public.reopen_contractor_pay_period(uuid) to authenticated;
