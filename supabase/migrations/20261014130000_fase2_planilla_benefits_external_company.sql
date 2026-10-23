-- Fase 2 — Planilla: prestaciones que paga otra empresa
--
-- Algunos empleados cobran una parte de su salario por otra empresa (ej.
-- Confecciones Marggie S.A.) y sus prestaciones (décimo, vacación, prima) las
-- paga esa empresa; después se hace un arqueo de cuentas y se reembolsa. Esta
-- columna guarda el nombre de esa empresa. Con valor: las prestaciones quedan
-- registradas y cuentan en el total de la planilla, pero NO salen en el archivo
-- de transferencias de Ebony. NULL = las paga Ebony (lo normal).

alter table public.payroll_employees
  add column benefits_external_company text;

comment on column public.payroll_employees.benefits_external_company is
  'Empresa que paga las prestaciones del empleado en lugar de Ebony (NULL = las paga Ebony).';
