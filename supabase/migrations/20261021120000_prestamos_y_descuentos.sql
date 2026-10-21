-- Préstamos y descuentos en un solo lugar (Personal → Pagos → Préstamos y
-- descuentos, y la pestaña del mismo nombre en el detalle del empleado).
--
-- 1) payroll_loans acepta, además de préstamo y adelanto, herramienta, daño e
--    InDrive. Herramienta y daño van en cuotas sin interés; InDrive es una
--    sola cuota en la quincena del viaje. Todo usa el mismo calendario de
--    cuotas (filas de payroll_ledger_entries enlazadas por loan_id).
--    (La migración 20261013120000 pedía herramienta/daño acá, pero en la base
--    quedó aplicada a medias: este CHECK seguía en préstamo/adelanto.)
-- 2) contractor_ledger_entries acepta herramienta, daño e InDrive: se
--    registran como movimientos que reducen el saldo del contratista.
--
-- InDrive ya no usa la tabla payroll_indrive_rides (nunca llegó a crearse en
-- la base): cada viaje es un registro de payroll_loans que se descuenta.
--
-- Solo reemplaza dos CHECK por versiones más amplias: todo lo que ya existe
-- sigue siendo válido.

alter table public.payroll_loans drop constraint if exists payroll_loans_category_check;
alter table public.payroll_loans
  add constraint payroll_loans_category_check
  check (category in ('prestamo', 'adelanto', 'herramienta', 'dano', 'indrive'));

alter table public.contractor_ledger_entries drop constraint if exists contractor_ledger_entries_category_check;
alter table public.contractor_ledger_entries
  add constraint contractor_ledger_entries_category_check
  check (category in (
    'trabajo', 'bono', 'extra', 'pago', 'prestamo', 'adelanto', 'material', 'gasto_operativo', 'ajuste',
    'herramienta', 'dano', 'indrive'
  ));
