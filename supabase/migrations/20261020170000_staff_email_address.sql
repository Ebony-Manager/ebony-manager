-- Correo personal y dirección en la ficha de empleados y contratistas.
--
-- Vienen del formulario de registro de empleados (Jotform), que ya los pedía;
-- la ficha no tenía dónde guardarlos. Texto libre, opcionales.
--
-- Idempotente: se puede correr más de una vez.

alter table public.payroll_employees
  add column if not exists email   text,
  add column if not exists address text;

alter table public.contractors
  add column if not exists email   text,
  add column if not exists address text;

comment on column public.payroll_employees.email is 'Correo personal (opcional).';
comment on column public.payroll_employees.address is 'Dirección de domicilio, texto libre (opcional).';
comment on column public.contractors.email is 'Correo personal (opcional).';
comment on column public.contractors.address is 'Dirección de domicilio, texto libre (opcional).';
