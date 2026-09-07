-- Fase 2 — Planilla (empleados asalariados por quincena) para Ebony.
--
-- Portado del módulo Payroll de Atlas (Life OS). Atlas guarda en SQLite
-- local; Ebony usa Supabase (Postgres). Este archivo cambia SOLO la capa
-- de datos: las fórmulas de cálculo (décimo, vacación proporcional, prima
-- de antigüedad, cuotas de préstamo) se reusan casi 1:1 en el servicio de
-- TypeScript, porque el modelo de columnas de abajo es el mismo que el de
-- Atlas.
--
-- Alcance
--   * SOLO planilla de empleados FIJOS asalariados: quincena base, horas/
--     días extra y descontados, viáticos, bonos, días libres, décimo /
--     vacación / prima de antigüedad, y un ledger de préstamos/adelantos/
--     herramientas/daños con cuotas que se auto-aplican a quincenas
--     futuras.
--   * NO incluye ebanistas por proyecto ni pintores con cuenta de
--     materiales. Esos son otro módulo ("contratistas") en otra rama. El
--     prefijo `payroll_` y la semántica "payroll_employees = trabajador de
--     planilla" se dejan a propósito para que ese módulo futuro viva al
--     lado (contractors, contractor_*) sin rehacer esto.
--
-- Diferencias vs. Atlas (ver docs/fase2-planilla-port.md para el detalle)
--   * `id`: uuid generado por Postgres (`gen_random_uuid()`), no nanoid en
--     la app.
--   * Fechas de calendario (`start_date`, `end_date`, `entry_date`,
--     `request_date`): tipo `date`, no TEXT.
--   * `paid`: `boolean`, no INTEGER 0/1. Timestamps: `timestamptz` con
--     `now()`, no `datetime('now')`.
--   * Cantidades (horas/días): `numeric(10,2)`, no REAL.
--   * DINERO: `integer` de centavos enteros, igual que Atlas. Un renglón es
--     una quincena de una persona; no se acerca al techo de `integer`
--     ($21.4M). Si algún día hiciera falta, `alter ... type bigint` es
--     trivial y no cambia ninguna fórmula.
--   * SE ELIMINA `property_id`: Ebony es una sola empresa, no hay "propiedad".
--   * SE ELIMINA `finance_transaction_id`: no hay módulo de Finanzas/Gastos
--     todavía. Se puede re-agregar como referencia blanda cuando exista.
--
-- Seguridad
--   * La planilla es SOLO para admin. Aunque un trabajador llegue a usar la
--     app algún día, NUNCA ve este módulo.
--   * RLS ON en las 4 tablas. `anon` sin acceso. Única policy por tabla:
--     `private.is_admin()` para SELECT/INSERT/UPDATE/DELETE. Mismo patrón y
--     mismos helpers del esquema `private` que la Fase 1
--     (`20260906170000_fase1_auth_rls.sql`); este archivo reusa
--     `private.is_admin()` y `private.touch_updated_at()`, no los redefine.
--
-- Este archivo es la fuente de verdad del esquema. Se aplica al proyecto
-- remoto vía Supabase MCP (`apply_migration`) o el SQL editor del
-- dashboard. NO se ha aplicado todavía — espera el OK del esquema.

-- ============================================================================
-- 1. payroll_employees — trabajadores asalariados de planilla
-- ============================================================================
-- base_salary_cents es el salario MENSUAL en papel al día de hoy. La base
-- realmente pagada en una quincena vive en cada payroll_entries (abajo),
-- porque un aumento real no reescribe la historia.
create table public.payroll_employees (
  id                        uuid        primary key default gen_random_uuid(),
  name                      text        not null,
  position                  text,
  start_date                date,
  end_date                  date,
  status                    text        not null default 'ACTIVE'
                                        check (status in ('ACTIVE', 'INACTIVE')),
  base_salary_cents         integer     not null default 0,

  -- NULL = "las prestaciones (décimo/vacación/prima) se calculan sobre el
  -- mismo salario que base_salary_cents". Se setea solo cuando hay un
  -- acuerdo real de calcular los beneficios legales sobre una base distinta
  -- (normalmente menor) a la que se paga — el caso "Acumulado a 500" de la
  -- hoja de referencia, calculado en vez de duplicado a mano.
  benefits_base_salary_cents integer,

  notes                     text,
  -- Se setea junto con end_date al liquidar a alguien: aclaraciones,
  -- disputas o ajustes puntuales sobre ESA liquidación específica, aparte
  -- del campo `notes` general.
  liquidation_notes         text,

  -- Datos personales / de contacto (tab Empleados). Un solo campo de
  -- documento sirve para cédula o pasaporte. El contrato firmado o el scan
  -- de la cédula NO van acá — irán en una tabla de documentos genérica
  -- cuando exista.
  phone                     text,
  id_document               text,
  emergency_contact_name    text,
  emergency_contact_phone   text,
  contract_info             text,

  sort_order                integer     not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.payroll_employees is
  'Trabajador asalariado de planilla (quincena fija). No es un usuario de la app y nunca se cuelga de profiles. Módulo solo-admin. Contratistas (ebanistas por proyecto, pintores con materiales) irán en tablas contractor_* aparte.';

create index idx_payroll_employees_status on public.payroll_employees (status);

alter table public.payroll_employees enable row level security;

-- ============================================================================
-- 2. payroll_entries — una fila por empleado por quincena
-- ============================================================================
-- period_half es 1 o 2 (1a/2a quincena). SIN columna de "total" guardada: el
-- total de la quincena es base + extras + bonos - descuentos - (abonos a
-- préstamo de payroll_ledger_entries de esta quincena), calculado en el
-- servicio de TypeScript cada vez que se lee. Un total guardado es
-- exactamente el número que se desincroniza en una hoja hecha a mano — el
-- problema que esta tabla existe para resolver.
create table public.payroll_entries (
  id                          uuid        primary key default gen_random_uuid(),
  employee_id                 uuid        not null references public.payroll_employees (id) on delete cascade,
  period_year                 integer     not null,
  period_month                integer     not null check (period_month between 1 and 12),
  period_half                 integer     not null default 1 check (period_half in (1, 2)),

  base_pay_cents              integer     not null default 0,

  -- extra_hours / extra_days: la CANTIDAD que entra el usuario.
  -- *_cents: a cuánto resolvió esa cantidad a la tarifa por hora/día del
  -- empleado EN EL MOMENTO en que se entró (nunca se recalcula después, así
  -- un cambio de salario futuro no reflota una quincena ya registrada).
  -- Ver src/lib/planilla/payroll-rates.ts para la fórmula de tarifa.
  extra_hours                 numeric(10,2) not null default 0,
  extra_hours_cents           integer     not null default 0,
  extra_days                  numeric(10,2) not null default 0,
  extra_days_cents            integer     not null default 0,

  viaticos_cents             integer     not null default 0,
  bonus_cents                integer     not null default 0,
  -- "Días Libres": subsidio pagado por días libres otorgados, aparte de
  -- extra_days_cents (que son días extra TRABAJADOS, la dirección opuesta).
  dias_libres_cents          integer     not null default 0,

  -- Horas / Días Descontados: horas o días sin pagar por debajo de la
  -- jornada normal, con la misma tarifa por hora/día que sus contrapartes
  -- positivas. other_deduction_cents queda para cualquier otro descuento
  -- que no sea uno de estos dos. Misma regla de "congelar la tarifa al
  -- momento de entrar" que extra_days.
  horas_descontadas          numeric(10,2) not null default 0,
  horas_descontadas_cents    integer     not null default 0,
  dias_descontados           numeric(10,2) not null default 0,
  dias_descontados_cents     integer     not null default 0,
  other_deduction_cents      integer     not null default 0,

  -- Montos de décimo / vacación / prima REALMENTE pagados esta quincena —
  -- distinto del acumulado bruto que calculan las fórmulas. La fórmula dice
  -- lo que se debe por ley; estas columnas registran lo que efectivamente
  -- se entregó (montos típicos en abril/agosto/diciembre). El saldo
  -- pendiente es acumulado menos suma de estos, nunca se guarda aparte.
  -- Un prima_antiguedad_paid_cents > 0 además reinicia el reloj del
  -- acumulado de prima hacia adelante, igual que vacation_paid_cents ya lo
  -- hace para vacación.
  decimo_paid_cents          integer     not null default 0,
  vacation_paid_cents        integer     not null default 0,
  prima_antiguedad_paid_cents integer    not null default 0,

  payment_method             text        not null default 'efectivo'
                                         check (payment_method in ('efectivo', 'transferencia', 'yappy', 'cheque')),
  paid                       boolean     not null default false,
  paid_at                    timestamptz,
  notes                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  unique (employee_id, period_year, period_month, period_half)
);

comment on table public.payroll_entries is
  'Una quincena de un empleado. Sin total guardado: se computa en el servicio. period_half 1|2.';

create index idx_payroll_entries_employee on public.payroll_entries (employee_id);
create index idx_payroll_entries_period   on public.payroll_entries (period_year, period_month, period_half);

alter table public.payroll_entries enable row level security;

-- ============================================================================
-- 3. payroll_ledger_entries — préstamos / adelantos / herramientas / daños
-- ============================================================================
-- Un solo ledger genérico con campo `category` en vez de cuatro columnas
-- fijas, así una categoría de descuento nueva nunca necesita cambiar el
-- esquema. Filas 'debt' aumentan lo que el empleado debe (préstamo
-- otorgado, herramienta cargada a su cuenta); filas 'payment' lo bajan (un
-- abono descontado de una quincena dada). El saldo que se debe siempre es
-- sum(debt) - sum(payment realizado), computado en el servicio, nunca
-- guardado.
--
-- 'seguro_social' y 'carnet' son categorías específicas de ciertos
-- empleados. El servicio trata Caja de Seguro Social como línea
-- informativa (dinero remitido al gobierno), nunca reduce lo que se le
-- paga a la persona.
create table public.payroll_ledger_entries (
  id                uuid        primary key default gen_random_uuid(),
  employee_id       uuid        not null references public.payroll_employees (id) on delete cascade,
  category          text        not null default 'otro'
                                check (category in ('prestamo', 'adelanto', 'herramienta', 'dano', 'seguro_social', 'carnet', 'otro')),
  direction         text        not null check (direction in ('debt', 'payment')),
  amount_cents      integer     not null,
  entry_date        date        not null,

  -- En qué quincena se otorgó o contra cuál se abonó, si aplica.
  payroll_entry_id  uuid        references public.payroll_entries (id) on delete set null,
  -- Qué payroll_loans creó esta fila automáticamente (el monto otorgado, o
  -- una cuota programada), si aplica. NULL para un movimiento agregado a
  -- mano por el diálogo genérico del ledger. Permite a cancelLoan borrar
  -- exactamente las cuotas futuras aún no realizadas de ese préstamo, y a
  -- la UI reagrupar las cuotas para "3 de 8 pagadas". La FK a payroll_loans
  -- se agrega en la sección 4 (esa tabla se crea después que esta).
  loan_id           uuid,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.payroll_ledger_entries is
  'Ledger genérico de deudas/abonos del empleado (préstamo, adelanto, herramienta, daño, seguro_social, carnet, otro). Saldo = sum(debt) - sum(payment realizado), computado, nunca guardado.';

create index idx_payroll_ledger_employee on public.payroll_ledger_entries (employee_id);
create index idx_payroll_ledger_loan     on public.payroll_ledger_entries (loan_id);
create index idx_payroll_ledger_entry    on public.payroll_ledger_entries (payroll_entry_id);

alter table public.payroll_ledger_entries enable row level security;

-- ============================================================================
-- 4. payroll_loans — préstamos y adelantos con calendario de cuotas
-- ============================================================================
-- El descuento no depende de que quien hace la planilla se acuerde de
-- registrarlo cada quincena: createLoan materializa de una vez todas las
-- cuotas como payroll_ledger_entries 'payment', cada una enganchada a su
-- quincena futura vía payroll_entry_id.
--
-- payment_method es el ESQUEMA de reparto de cuotas (hoy solo 'cuota_fija'
-- — cuotas iguales, ej. $200 en 8 quincenas = $25/quincena — se deja como
-- texto abierto para un esquema futuro tipo "% del salario" sin otra
-- migración), NO el método con que se le entregó el dinero al empleado.
--
-- start_period_* es la primera quincena que lleva cuota (por default: la
-- quincena de la fecha de solicitud si es adelanto, la siguiente si es
-- préstamo — editable al crear).
--
-- SIN columna de "cuotas pagadas" ni "saldo pendiente": eso se deriva
-- contando los payroll_ledger_entries reales vinculados por loan_id. status
-- 'active' | 'cancelled' — un préstamo cancelado pierde sus cuotas futuras
-- (las ya pagadas nunca se tocan).
create table public.payroll_loans (
  id                   uuid        primary key default gen_random_uuid(),
  employee_id          uuid        not null references public.payroll_employees (id) on delete cascade,
  category             text        not null check (category in ('prestamo', 'adelanto')),
  principal_cents      integer     not null,
  payment_method       text        not null default 'cuota_fija',
  num_installments     integer     not null default 1 check (num_installments >= 1),
  request_date         date        not null,
  start_period_year    integer     not null,
  start_period_month   integer     not null check (start_period_month between 1 and 12),
  start_period_half    integer     not null default 1 check (start_period_half in (1, 2)),
  status               text        not null default 'active'
                                   check (status in ('active', 'cancelled')),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.payroll_loans is
  'Préstamo/adelanto con calendario de cuotas auto-aplicadas a quincenas futuras. Cuotas pagadas y saldo se derivan de payroll_ledger_entries por loan_id, nunca se guardan.';

create index idx_payroll_loans_employee on public.payroll_loans (employee_id);

alter table public.payroll_loans enable row level security;

-- payroll_ledger_entries.loan_id -> payroll_loans.id. La columna se declaró
-- sin FK en la sección 3 porque payroll_loans todavía no existía ahí; acá,
-- ya creada, se engancha la constraint.
alter table public.payroll_ledger_entries
  add constraint payroll_ledger_entries_loan_id_fkey
  foreign key (loan_id) references public.payroll_loans (id) on delete set null;

-- ============================================================================
-- 5. updated_at — reusa el trigger de la Fase 1 (private.touch_updated_at)
-- ============================================================================
create trigger payroll_employees_touch_updated_at
  before update on public.payroll_employees
  for each row execute function private.touch_updated_at();

create trigger payroll_entries_touch_updated_at
  before update on public.payroll_entries
  for each row execute function private.touch_updated_at();

create trigger payroll_ledger_entries_touch_updated_at
  before update on public.payroll_ledger_entries
  for each row execute function private.touch_updated_at();

create trigger payroll_loans_touch_updated_at
  before update on public.payroll_loans
  for each row execute function private.touch_updated_at();

-- ============================================================================
-- 6. RLS — solo admin. Todo lo demás (vendedor incluido) no ve nada.
-- ============================================================================
create policy "payroll_employees_admin_all"
  on public.payroll_employees for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "payroll_entries_admin_all"
  on public.payroll_entries for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "payroll_ledger_entries_admin_all"
  on public.payroll_ledger_entries for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "payroll_loans_admin_all"
  on public.payroll_loans for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ============================================================================
-- 7. Grants — anon nada; authenticated sigue filtrado por las policies
-- ============================================================================
revoke all on public.payroll_employees      from anon;
revoke all on public.payroll_entries        from anon;
revoke all on public.payroll_ledger_entries from anon;
revoke all on public.payroll_loans          from anon;

grant select, insert, update, delete on public.payroll_employees      to authenticated;
grant select, insert, update, delete on public.payroll_entries        to authenticated;
grant select, insert, update, delete on public.payroll_ledger_entries to authenticated;
grant select, insert, update, delete on public.payroll_loans          to authenticated;
