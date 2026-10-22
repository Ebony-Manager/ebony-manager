-- Historia → contratos. No cambia el saldo de nadie.
--
-- 1. Cada combinación contratista + proyecto con trabajo registrado pasa a
--    ser un contrato (nombre = el del proyecto, fecha = su primer trabajo).
--    Sus movimientos de trabajo / extra / bono quedan enganchados a él.
--    Queda activo si el proyecto está activo; si no, terminado.
-- 2. Los pagos y descuentos viejos eran generales (no decían a qué
--    trabajo iban), así que se reparten del más viejo al más nuevo: cada
--    uno cubre primero lo acreditado más antiguo (contrato o trabajo
--    suelto). Lo que sobra queda "a cuenta" y se aplica en el próximo pago.

insert into public.contractor_contracts (contractor_id, project_id, name, contract_date, status)
select e.contractor_id, e.project_id, p.name, min(e.entry_date),
       case when p.status = 'ACTIVE' then 'ACTIVE' else 'COMPLETED' end
from public.contractor_ledger_entries e
join public.projects p on p.id = e.project_id
where e.category in ('trabajo', 'extra', 'bono') and e.loan_id is null
group by e.contractor_id, e.project_id, p.name, p.status;

update public.contractor_ledger_entries e
set contract_id = k.id
from public.contractor_contracts k
where k.contractor_id = e.contractor_id and k.project_id = e.project_id
  and e.category in ('trabajo', 'extra', 'bono') and e.loan_id is null;

do $$
declare
  s record;
  t record;
  v_rem integer;
  v_take integer;
begin
  create temp table _targets on commit drop as
  select row_number() over (order by contractor_id, d, ca nulls first, contract_id, credit_entry_id) as seq,
         contractor_id, contract_id, credit_entry_id, rem
  from (
    select k.contractor_id, k.id as contract_id, null::uuid as credit_entry_id, k.contract_date as d,
           null::timestamptz as ca, public.contractor_contract_value_cents(k.id) as rem
    from public.contractor_contracts k
    union all
    select e.contractor_id, null::uuid, e.id, e.entry_date, e.created_at, e.amount_cents
    from public.contractor_ledger_entries e
    where e.direction = 'a_favor' and e.contract_id is null and not e.ebony_absorbs_material
  ) z
  where rem > 0;

  for s in
    select e.id, e.contractor_id, e.amount_cents
    from public.contractor_ledger_entries e
    where e.direction = 'reduce' and e.contract_id is null and not e.ebony_absorbs_material
      and e.entry_date <= (now() at time zone 'America/Panama')::date
    order by e.contractor_id, e.entry_date, e.created_at
  loop
    v_rem := s.amount_cents;
    for t in
      select seq, contract_id, credit_entry_id, rem from _targets
      where contractor_id = s.contractor_id and rem > 0
      order by seq
    loop
      exit when v_rem <= 0;
      v_take := least(v_rem, t.rem);
      insert into public.contractor_payment_allocations (contractor_id, source_entry_id, contract_id, credit_entry_id, amount_cents)
      values (s.contractor_id, s.id, t.contract_id, t.credit_entry_id, v_take);
      update _targets set rem = rem - v_take where seq = t.seq;
      v_rem := v_rem - v_take;
    end loop;
  end loop;
end;
$$;
