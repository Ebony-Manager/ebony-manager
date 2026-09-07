-- Fase 2 — Historial de sueldos / aumentos por fecha (módulo Planilla).
--
-- Hasta ahora el sueldo de un empleado era un solo valor en
-- payroll_employees.base_salary_cents. Con esta tabla el sueldo pasa a
-- ser un HISTORIAL: cada fila es "desde esta quincena, el sueldo mensual
-- es X". El sueldo vigente en una quincena dada es la fila más reciente
-- cuya quincena efectiva sea <= esa quincena.
--
-- Reglas (confirmadas con el dueño):
--   * Un aumento aplica SIEMPRE desde el inicio de una quincena, nunca a
--     mitad — por eso la fecha efectiva es (año, mes, mitad), no un
--     `date` libre.
--   * El sueldo nuevo aplica de esa quincena en adelante; las quincenas
--     anteriores conservan el sueldo viejo.
--
-- Uso previsto (capa de servicio, NO en esta migración):
--   * Al crear un empleado, su sueldo inicial se inserta como la primera
--     fila de este historial, vigente desde la quincena de su fecha de
--     ingreso.
--   * Registro deriva la "Quincena Base" y las tarifas por hora/día del
--     sueldo VIGENTE de esa quincena (la columna Base pasa a solo
--     lectura). La regla de "congelar la tarifa al entrar" para horas
--     extra / descuentos se mantiene igual.
--   * Las fórmulas de Décimo / Vacación / Prima / Préstamos NO cambian.
--
-- No hay datos que migrar: las 4 tablas de planilla quedaron vacías.
--
-- Seguridad: mismo patrón que el resto de Planilla — RLS ON, una única
-- policy solo-admin con private.is_admin(), anon sin acceso, y el
-- trigger de updated_at reusa private.touch_updated_at() de la Fase 1.
--
-- Este archivo es la fuente de verdad del esquema. Se aplica al proyecto
-- remoto vía Supabase MCP (apply_migration) o el SQL editor del
-- dashboard. NO se ha aplicado todavía — espera el OK del esquema.

-- ============================================================================
-- payroll_salary_changes — un renglón por "desde esta quincena el sueldo
-- mensual es X"
-- ============================================================================
create table public.payroll_salary_changes (
  id                          uuid        primary key default gen_random_uuid(),
  employee_id                 uuid        not null references public.payroll_employees (id) on delete cascade,

  -- Sueldo mensual "en papel" vigente desde la quincena efectiva.
  monthly_salary_cents        integer     not null check (monthly_salary_cents >= 0),

  -- NULL = las prestaciones (Décimo/Vacación/Prima) se calculan sobre el
  -- mismo `monthly_salary_cents`. Se setea solo cuando hay un acuerdo
  -- real de calcularlas sobre una base distinta (normalmente menor) —
  -- el caso "Acumulado a 500". Igual semántica que
  -- payroll_employees.benefits_base_salary_cents, pero por tramo de
  -- vigencia.
  benefits_base_salary_cents  integer     check (benefits_base_salary_cents is null or benefits_base_salary_cents >= 0),

  -- Quincena desde la cual aplica este sueldo (inicio de quincena, nunca
  -- a mitad). half = 1 (1a quincena) | 2 (2a quincena).
  effective_year              integer     not null,
  effective_month             integer     not null check (effective_month between 1 and 12),
  effective_half              integer     not null default 1 check (effective_half in (1, 2)),

  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- Un solo cambio de sueldo por empleado por quincena efectiva. Registrar
  -- un aumento "desde" una quincena que ya tiene fila es una edición de
  -- esa fila (upsert sobre esta constraint), no un duplicado. El índice
  -- que crea esta constraint —(employee_id, effective_year,
  -- effective_month, effective_half)— es además el que sirve la consulta
  -- "sueldo vigente en la quincena X" (filtra por employee_id, ordena por
  -- la fecha efectiva desc, toma 1), así que no hace falta un índice
  -- suelto por employee_id como en las otras tablas.
  unique (employee_id, effective_year, effective_month, effective_half)
);

comment on table public.payroll_salary_changes is
  'Historial de sueldos por empleado: cada fila fija el sueldo mensual vigente desde una quincena (año/mes/mitad). El sueldo de una quincena dada es la fila más reciente con fecha efectiva <= esa quincena. La fila inicial la crea la capa de servicio al dar de alta al empleado (vigente desde su ingreso). Módulo solo-admin.';

alter table public.payroll_salary_changes enable row level security;

-- updated_at — reusa el trigger de la Fase 1.
create trigger payroll_salary_changes_touch_updated_at
  before update on public.payroll_salary_changes
  for each row execute function private.touch_updated_at();

-- RLS — solo admin. Vendedor (y cualquier otro rol) no ve nada.
create policy "payroll_salary_changes_admin_all"
  on public.payroll_salary_changes for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Grants — anon nada; authenticated sigue filtrado por la policy.
revoke all on public.payroll_salary_changes from anon;
grant select, insert, update, delete on public.payroll_salary_changes to authenticated;
