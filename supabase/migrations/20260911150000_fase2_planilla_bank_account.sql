-- Fase 2 — Planilla · Taller: cuenta bancaria del empleado (Tanda 1/6)
--
-- Objetivo: base para el export a Banco General (Tanda 5) — banco, tipo
-- de cuenta y número. Si el formato real de export termina necesitando
-- otros campos, se ajusta entonces; no se adivina más por ahora.
--
-- Aditivo: 3 columnas nuevas en payroll_employees, todas NULLABLE, sin
-- default que reescriba filas existentes. La RLS admin-only y el trigger
-- de updated_at de la tabla ya existen desde 20260906180000_fase2_planilla.sql
-- — este archivo no los toca.
--
-- Aplicada el 2026-09-11 vía el MCP de Supabase (proyecto Ebony).

alter table public.payroll_employees
  add column bank_name           text,
  add column bank_account_type   text check (bank_account_type is null or bank_account_type in ('ahorro', 'corriente')),
  add column bank_account_number text;

comment on column public.payroll_employees.bank_name is 'Banco de la cuenta donde se le paga (texto libre). NULL si aún no se registra.';
comment on column public.payroll_employees.bank_account_type is '''ahorro'' o ''corriente''. NULL si aún no se registra.';
comment on column public.payroll_employees.bank_account_number is 'Número de cuenta bancaria (texto libre, tal como lo da el banco). NULL si aún no se registra.';
