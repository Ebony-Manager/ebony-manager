-- Fase 2 — Planilla: categoría de empleado (Taller/Administrativo) +
-- catálogo editable de posiciones.
--
-- Categoría es solo una etiqueta para filtrar/agrupar — Taller y
-- Administrativo usan el mismo motor de planilla (mismas fórmulas de
-- décimo/vacación/prima, mismo Registro, mismo ledger de préstamos), no
-- es un sistema aparte. Aditivo: 1 columna nueva en payroll_employees,
-- NOT NULL con default 'taller' para que ninguna fila existente quede
-- sin categoría.
--
-- El catálogo de posiciones (`payroll_positions`) es nuevo: Teofilo lo
-- administra desde la UI (Gestionar funciones, en el formulario de
-- empleado), sin tocar código. `payroll_employees.position` sigue siendo
-- texto libre — este catálogo solo cura las opciones sugeridas del
-- dropdown, con "Otro" como escape a texto libre; nunca fuerza ni valida
-- los datos que ya hay cargados a mano. RLS admin-only y trigger de
-- updated_at, mismo patrón que el resto de Planilla
-- (20260906180000_fase2_planilla.sql).
--
-- NO aplicada todavía: pendiente de OK del dueño.

-- ============================================================================
-- 1. payroll_employees.categoria
-- ============================================================================
alter table public.payroll_employees
  add column categoria text not null default 'taller'
    check (categoria in ('taller', 'administrativo'));

comment on column public.payroll_employees.categoria is 'Taller o Administrativo — etiqueta para filtrar/agrupar, ambos usan el mismo motor de planilla.';

-- ============================================================================
-- 2. payroll_positions — catálogo editable de posiciones/funciones
-- ============================================================================
create table public.payroll_positions (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  active     boolean     not null default true,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payroll_positions is
  'Catálogo editable de funciones/posiciones de planilla (Calificado, Ayudante, Jefe de Taller, etc.). Alimenta el dropdown de "Posición" en el formulario de empleado — position en payroll_employees sigue siendo texto libre, este catálogo solo cura las opciones sugeridas.';

alter table public.payroll_positions enable row level security;

create trigger payroll_positions_touch_updated_at
  before update on public.payroll_positions
  for each row execute function private.touch_updated_at();

create policy "payroll_positions_admin_all"
  on public.payroll_positions for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

revoke all on public.payroll_positions from anon;
grant select, insert, update, delete on public.payroll_positions to authenticated;

insert into public.payroll_positions (name, sort_order) values
  ('Calificado', 0),
  ('Ayudante', 1),
  ('Jefe de Taller', 2),
  ('Diseñadora', 3);
