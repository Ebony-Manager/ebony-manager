-- "Otro descuento" (seguro social, carnet, uniforme…) como un tipo más de
-- Préstamos y descuentos, para empleados y contratistas: con nota y en 1 o
-- varias cuotas. Reemplaza la columna "Otros descuentos" de la Quincena y el
-- panel de movimientos sueltos, que nunca se usaron.
-- payroll_ledger_entries ya aceptaba 'otro'. Solo amplía CHECKs.

alter table public.payroll_loans drop constraint if exists payroll_loans_category_check;
alter table public.payroll_loans
  add constraint payroll_loans_category_check
  check (category in ('prestamo', 'adelanto', 'herramienta', 'dano', 'indrive', 'otro'));

alter table public.contractor_loans drop constraint if exists contractor_loans_category_check;
alter table public.contractor_loans
  add constraint contractor_loans_category_check
  check (category in ('prestamo', 'adelanto', 'herramienta', 'dano', 'indrive', 'otro'));

alter table public.contractor_ledger_entries drop constraint if exists contractor_ledger_entries_category_check;
alter table public.contractor_ledger_entries
  add constraint contractor_ledger_entries_category_check
  check (category in (
    'trabajo', 'bono', 'extra', 'pago', 'prestamo', 'adelanto', 'material', 'gasto_operativo', 'ajuste',
    'herramienta', 'dano', 'indrive', 'otro'
  ));
