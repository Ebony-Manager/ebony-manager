-- ============================================================================
-- Ebony Manager — cambios pendientes de la base de datos (corren una sola vez)
--
-- Cómo: Supabase → SQL Editor → pegar TODO este archivo → Run.
-- Es seguro correrlo más de una vez (no rompe nada si ya se aplicó).
-- Qué agrega:
--   1) "Lleva prestaciones" por empleado (interruptor de décimo/vacación/prima).
--   2) "Sus prestaciones las paga otra empresa" (ej. Confecciones Marggie S.A.).
-- ============================================================================

alter table public.payroll_employees
  add column if not exists benefits_enabled boolean not null default true;

comment on column public.payroll_employees.benefits_enabled is
  'Si el empleado lleva décimo, vacación y prima de antigüedad. false = no se acumulan ni se muestran.';

alter table public.payroll_employees
  add column if not exists benefits_external_company text;

comment on column public.payroll_employees.benefits_external_company is
  'Empresa que paga las prestaciones del empleado en lugar de Ebony (NULL = las paga Ebony).';
