-- Cierre de saldo (al inactivar / liquidar): ahora también salda la
-- retención de garantía pendiente — se devuelve dentro del mismo cierre y el
-- ajuste cubre la diferencia, así no queda una devolución por pagar después.
-- Lo demás igual que en 20261022090000_zero_contractor_balance.sql.

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

  -- La retención de garantía que tenga se salda aquí (se devuelve y entra en
  -- el ajuste), para que no quede una devolución pendiente que se pague dos
  -- veces después del cierre.
  insert into contractor_ledger_entries (contractor_id, entry_date, category, direction, amount_cents, project_id, description)
  select p_contractor_id, p_date, 'retencion', 'a_favor', r.held, r.project_id, 'Devolución de retención (cierre de saldo)'
  from (
    select project_id, sum(case when direction = 'reduce' then amount_cents else -amount_cents end)::integer as held
    from contractor_ledger_entries
    where contractor_id = p_contractor_id and category = 'retencion'
    group by project_id
  ) r
  where r.held > 0;

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
