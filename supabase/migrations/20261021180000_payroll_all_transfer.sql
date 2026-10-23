-- Corrección de datos: todos los pagos de planilla son por transferencia
-- bancaria. Las quincenas marcadas "efectivo" (137, de la carga inicial)
-- eran un error. La columna Método se quitó de la Quincena.
update public.payroll_entries set payment_method = 'transferencia' where payment_method <> 'transferencia';
