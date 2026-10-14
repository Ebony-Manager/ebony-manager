-- Fase 2 — Planilla: "lleva prestaciones" por empleado
--
-- Interruptor por empleado para décimo, vacación proporcional y prima de
-- antigüedad. Con false no se acumulan ni se muestran (ej. alguien cuyas
-- prestaciones se manejan fuera de esta planilla). Aditivo: una columna
-- nueva con default true, así todos los empleados actuales siguen igual.

alter table public.payroll_employees
  add column benefits_enabled boolean not null default true;

comment on column public.payroll_employees.benefits_enabled is
  'Si el empleado lleva décimo, vacación y prima de antigüedad. false = no se acumulan ni se muestran.';
