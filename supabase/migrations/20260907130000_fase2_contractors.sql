-- Fase 2 — Contratistas por proyecto (ebanistas y pintores) · ETAPA 1
--
-- Módulo HERMANO de Planilla, NO una extensión de los asalariados:
-- `contractors` no referencia public.profiles ni public.payroll_employees.
-- No hay quincena base ni prestaciones (décimo / vacación / prima).
--
-- Modelo central — cuenta corriente derivada, nunca guardada:
--
--   saldo = SUM(amount_cents)  con direction = 'a_favor'  y ebony_absorbs_material = false
--         - SUM(amount_cents)  con direction = 'reduce'   y ebony_absorbs_material = false
--
--   saldo > 0  -> Ebony le debe al contratista
--   saldo < 0  -> el contratista debe compensar a Ebony
--
-- Un material que Ebony asume (ebony_absorbs_material = true) se DOCUMENTA
-- pero queda fuera de la suma: no mueve el saldo.
--
-- Proyectos: en la ETAPA 1 `projects` es una tabla mínima (nombre, cliente,
-- estado, notas). La ETAPA 2 le agrega los campos de contrato (m², tipo de
-- mueble, color, especificaciones, acuerdo de pago, fechas) con `alter table
-- add column` — aditivo, sin rehacer nada ni tocar el ledger.
--
-- Seguridad: mismo patrón que Planilla y Fase 1. RLS ON en las 3 tablas,
-- una sola policy por tabla contra `private.is_admin()`, `anon` sin acceso,
-- trigger de updated_at reutilizando `private.touch_updated_at()`
-- (20260906170000_fase1_auth_rls.sql). Este archivo NO redefine esos
-- helpers.
--
-- Dinero: `integer` de centavos enteros, igual que Planilla.
--
-- ESTA MIGRACIÓN NO SE HA APLICADO. Espera el OK del esquema.

-- ============================================================================
-- 1. contractors — directorio de ebanistas y pintores
-- ============================================================================
create table public.contractors (
  id                      uuid        primary key default gen_random_uuid(),
  name                    text        not null,

  -- Ebanista o pintor. Define qué formularios y categorías de ledger
  -- tienen sentido en la UI; no cambia el modelo de datos.
  contractor_type         text        not null
                                      check (contractor_type in ('ebanista', 'pintor')),

  -- Cédula o pasaporte, lo que la persona cargue — un solo campo, igual
  -- que payroll_employees.id_document.
  id_document             text,
  phone                   text,
  -- Persona/medio de contacto en texto libre (nombre de un familiar, otro
  -- número, correo…). Sin estructura fija.
  contact_info            text,

  -- Inicio de la relación con Ebony.
  start_date              date,

  -- ACTIVE / INACTIVE, mismos valores que payroll_employees.status para que
  -- el tipo de dominio en TypeScript sea el mismo. Las etiquetas "Activo /
  -- Inactivo" (ES) y "Active / Inactive" (EN) son de la capa i18n.
  status                  text        not null default 'ACTIVE'
                                      check (status in ('ACTIVE', 'INACTIVE')),

  -- Fecha de salida / liquidación. INACTIVE + end_date documenta el cierre;
  -- la historia y el saldo del contratista NUNCA se borran por esto.
  end_date                date,

  notes                   text,

  -- Orden manual en el directorio (drag para reordenar), igual que en
  -- Planilla.
  sort_order              integer     not null default 0,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.contractors is
  'Directorio de contratistas por proyecto (ebanistas y pintores). No son usuarios de la app ni empleados asalariados de payroll_employees. INACTIVE + end_date documentan el cierre de la relación; el estado de cuenta y su historia se conservan.';

create index idx_contractors_type_status on public.contractors (contractor_type, status);

alter table public.contractors enable row level security;

-- ============================================================================
-- 2. projects — proyectos de Ebony (versión mínima; crece en la Etapa 2)
-- ============================================================================
create table public.projects (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,

  -- Cliente final / diseñadora. Texto por ahora; si más adelante hay una
  -- tabla de clientes, se agrega un client_id nullable y se conserva este.
  client_name  text,

  -- ACTIVE / COMPLETED. Ilustrativo y ampliable (p. ej. 'CANCELLED' con un
  -- alter del check). Etiquetas "Activo / Terminado" en i18n.
  status       text        not null default 'ACTIVE'
                           check (status in ('ACTIVE', 'COMPLETED')),

  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.projects is
  'Proyecto de Ebanistería de Ebony. ETAPA 1: solo nombre, cliente, estado y notas. ETAPA 2 le añade campos de contrato (m2, tipo de mueble, color, especificaciones, acuerdo de pago, fechas) de forma aditiva.';

create index idx_projects_status on public.projects (status);

alter table public.projects enable row level security;

-- ============================================================================
-- 3. contractor_ledger_entries — fuente única del estado de cuenta
-- ============================================================================
create table public.contractor_ledger_entries (
  id                       uuid        primary key default gen_random_uuid(),

  -- Dueño del movimiento. Si se borra el contratista, se borra su libro
  -- completo (cascade) — no hay saldo suelto sin contratista.
  contractor_id            uuid        not null
                                       references public.contractors (id) on delete cascade,

  -- Proyecto al que se engancha el movimiento. NULLABLE: pagos, préstamos,
  -- adelantos y ajustes muchas veces no son de un proyecto puntual. Si el
  -- proyecto se borra, el movimiento se conserva con project_id = NULL
  -- (set null), nunca se borra plata por borrar un proyecto.
  project_id               uuid        references public.projects (id) on delete set null,

  entry_date               date        not null,

  -- Qué ocurrió. Valores en español, igual que payroll_ledger_entries.category:
  --   trabajo           - trabajo terminado/entregado           (normal: a_favor)
  --   bono              - bono o premio                         (normal: a_favor)
  --   extra             - trabajo extra fuera de lo pactado     (normal: a_favor)
  --   pago              - pago que Ebony le hace al contratista  (normal: reduce)
  --   prestamo          - préstamo entregado                    (normal: reduce)
  --   adelanto          - adelanto entregado                    (normal: reduce)
  --   material          - material entregado / a cuenta         (reduce, salvo que Ebony lo asuma)
  --   gasto_operativo   - gasto operativo trasladado ("In Drive", transporte…) (normal: reduce)
  --   ajuste            - corrección manual                     (a_favor o reduce, según el caso)
  category                 text        not null check (category in (
                                         'trabajo',
                                         'bono',
                                         'extra',
                                         'pago',
                                         'prestamo',
                                         'adelanto',
                                         'material',
                                         'gasto_operativo',
                                         'ajuste'
                                       )),

  -- Cómo mueve el saldo. Se guarda explícito (no se deriva de category) para
  -- que 'ajuste' pueda ir en cualquier sentido y para no pelear con datos
  -- reales. La UI puede sugerir el valor por defecto según la categoría.
  --   a_favor - sube el saldo (Ebony le debe más al contratista)
  --   reduce  - baja el saldo
  direction                text        not null check (direction in ('a_favor', 'reduce')),

  -- Datos opcionales del formulario de cobro cuando el monto se calcula por
  -- área. Si vienen ambos, amount_cents debería ser mt2 * cost_per_mt2_cents,
  -- pero el monto final SIEMPRE manda y se congela en amount_cents (mismo
  -- criterio que las horas/tarifa de Planilla): no se recalcula al leer.
  mt2                      numeric(12,2)
                                       check (mt2 is null or mt2 >= 0),
  cost_per_mt2_cents       integer     check (cost_per_mt2_cents is null or cost_per_mt2_cents >= 0),

  -- Monto del movimiento en centavos, magnitud SIEMPRE positiva; el sentido
  -- lo da `direction` (igual que payroll_ledger_entries.amount_cents).
  amount_cents             integer     not null check (amount_cents >= 0),

  -- Solo para category = 'material'. TRUE = Ebony asume ese material: el
  -- movimiento queda registrado para trazabilidad pero NO entra en la suma
  -- del saldo. El CHECK de abajo impide marcarlo en cualquier otra categoría.
  ebony_absorbs_material   boolean     not null default false,

  -- Texto libre tal como viene en las hojas actuales.
  client_text              text,
  description              text,
  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint contractor_ledger_absorbs_only_material
    check (not ebony_absorbs_material or category = 'material')
);

comment on table public.contractor_ledger_entries is
  'Estado de cuenta por contratista. El saldo se DERIVA: SUM(a_favor) - SUM(reduce) sobre los movimientos con ebony_absorbs_material = false; nunca se guarda como número. Cada movimiento congela mt2/tarifa/monto. saldo > 0 => Ebony le debe al contratista.';

create index idx_contractor_ledger_contractor_date
  on public.contractor_ledger_entries (contractor_id, entry_date, created_at);

create index idx_contractor_ledger_project
  on public.contractor_ledger_entries (project_id);

alter table public.contractor_ledger_entries enable row level security;

-- ============================================================================
-- 4. updated_at — trigger reutilizando el helper de la Fase 1
-- ============================================================================
create trigger contractors_touch_updated_at
  before update on public.contractors
  for each row execute function private.touch_updated_at();

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function private.touch_updated_at();

create trigger contractor_ledger_entries_touch_updated_at
  before update on public.contractor_ledger_entries
  for each row execute function private.touch_updated_at();

-- ============================================================================
-- 5. RLS — solo admin (mismo patrón y helper que Planilla / Fase 1)
-- ============================================================================
create policy "contractors_admin_all"
  on public.contractors for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "projects_admin_all"
  on public.projects for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "contractor_ledger_entries_admin_all"
  on public.contractor_ledger_entries for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ============================================================================
-- 6. Grants — anon nada; authenticated queda filtrado por RLS
-- ============================================================================
revoke all on public.contractors               from anon;
revoke all on public.projects                  from anon;
revoke all on public.contractor_ledger_entries from anon;

grant select, insert, update, delete on public.contractors               to authenticated;
grant select, insert, update, delete on public.projects                  to authenticated;
grant select, insert, update, delete on public.contractor_ledger_entries to authenticated;
