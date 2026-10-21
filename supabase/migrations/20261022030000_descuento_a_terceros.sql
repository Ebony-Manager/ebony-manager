-- "Descuento a terceros": lo que se le descuenta a un empleado para pagárselo
-- a otro (ej. una financiera con la que la persona tiene un préstamo). Se
-- maneja como los demás descuentos en cuotas (payroll_loans + cuotas en el
-- ledger), pero NO es dinero de Ebony: la app lo deja fuera de lo que el
-- empleado le debe a la empresa. A quién se le paga va en `notes`.
-- Solo amplía CHECKs (por ahora solo empleados).

alter table public.payroll_loans drop constraint if exists payroll_loans_category_check;
alter table public.payroll_loans
  add constraint payroll_loans_category_check
  check (category in ('prestamo', 'adelanto', 'herramienta', 'dano', 'indrive', 'otro', 'tercero'));

alter table public.payroll_ledger_entries drop constraint if exists payroll_ledger_entries_category_check;
alter table public.payroll_ledger_entries
  add constraint payroll_ledger_entries_category_check
  check (category in ('prestamo', 'adelanto', 'herramienta', 'dano', 'seguro_social', 'carnet', 'otro', 'indrive', 'interes', 'tercero'));
