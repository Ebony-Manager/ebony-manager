-- Fase 2 — Planilla: intereses en préstamos
--
-- Un préstamo puede cobrar intereses (a veces sí, a veces no, según el empleado
-- y el monto). payroll_loans.principal_cents sigue siendo lo que se entrega;
-- interest_cents es lo que se cobra de más, y las cuotas suman principal +
-- intereses. interest_mode / interest_rate_pct guardan cómo se calculó
-- ('monthly_pct' = % mensual por los meses del préstamo, 'total_pct' = % fijo
-- sobre el monto, 'fixed' = monto en dólares) para poder editarlo después.
--
-- En el ledger los intereses se anotan como una deuda propia (categoría
-- 'interes') enlazada al préstamo, así el saldo del empleado cuadra con las
-- cuotas y los intereses se pueden sumar aparte como ganancia de la empresa.

alter table public.payroll_loans
  add column interest_cents    integer not null default 0 check (interest_cents >= 0),
  add column interest_mode     text check (interest_mode is null or interest_mode in ('monthly_pct', 'total_pct', 'fixed')),
  add column interest_rate_pct numeric(7,3) check (interest_rate_pct is null or interest_rate_pct >= 0);

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where contype = 'c'
      and conrelid = 'public.payroll_ledger_entries'::regclass
      and pg_get_constraintdef(oid) like '%category%'
  loop
    execute format('alter table public.payroll_ledger_entries drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.payroll_ledger_entries
  add constraint payroll_ledger_entries_category_check
  check (category in ('prestamo', 'adelanto', 'herramienta', 'dano', 'seguro_social', 'carnet', 'otro', 'indrive', 'interes'));
