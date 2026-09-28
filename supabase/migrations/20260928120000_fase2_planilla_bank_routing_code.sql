-- Fase 2 — Planilla · Taller: ruta del banco del empleado
--
-- Objetivo: guardar el código de ruta (routing) de la cuenta bancaria de
-- cada empleado, junto a banco / tipo / número (ver
-- 20260911150000_fase2_planilla_bank_account.sql). Lo llena el dueño a
-- mano por empleado — cambia según el banco de cada quien.
--
-- La cédula NO se agrega aquí: payroll_employees ya tiene id_document
-- ("Cédula o Pasaporte"), que es la fuente única para el export bancario.
--
-- Aditivo: 1 columna nueva en payroll_employees, NULLABLE, sin default
-- que reescriba filas existentes. La RLS admin-only y el trigger de
-- updated_at de la tabla ya existen — este archivo no los toca.
--
-- NO aplicada todavía: pendiente de OK del dueño.

alter table public.payroll_employees
  add column bank_routing_code text;

comment on column public.payroll_employees.bank_routing_code is 'Ruta del banco / código de ruta (texto libre, tal como lo da el banco). NULL si aún no se registra.';
