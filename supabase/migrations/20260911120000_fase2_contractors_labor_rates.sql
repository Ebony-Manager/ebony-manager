-- Fase 2 — Contratistas · catálogo de tarifas de mano de obra
--
-- Objetivo: catálogo de tarifas (ebanistas y pintores) para armar ítems
-- de trabajo dentro de "Agregar Movimiento" (ledger de contratistas).
-- Esta migración es SOLO el catálogo + su seed; el selector de ítems en
-- el formulario de movimiento es la siguiente tanda.
--
-- Modelo:
--   - Pintor: precio único por ítem -> fase = NULL.
--   - Ebanista: cada ítem del PDF de tarifas se parte en dos registros,
--     uno por fase ('armado' y 'instalacion') -> fase NOT NULL.
--   El CHECK de abajo obliga esa combinación (pintor+NULL / ebanista+fase).
--
-- Dinero: integer de centavos enteros, igual que el resto de la app —
-- nunca floats para plata.
--
-- Seguridad: mismo patrón que el resto de Contratistas / Planilla.
-- Solo-admin vía RLS contra private.is_admin() (lectura y escritura —
-- son costos internos, el rol vendedor no los ve); anon sin acceso;
-- trigger de updated_at reutilizando private.touch_updated_at() (helpers
-- definidos en 20260906170000_fase1_auth_rls.sql, no se redefinen acá).
--
-- Aplicada el 2026-09-11 vía el MCP de Supabase (proyecto Ebony), con los
-- 14 registros iniciales precargados.

-- ============================================================================
-- 1. labor_rates — catálogo de tarifas
-- ============================================================================
create table public.labor_rates (
  id              uuid        primary key default gen_random_uuid(),

  contractor_type text        not null
                              check (contractor_type in ('ebanista', 'pintor')),

  -- Fase del trabajo. Solo aplica a ebanistas (armado / instalación son
  -- dos tarifas distintas del mismo ítem); un pintor cobra un precio
  -- único por ítem, sin fase.
  fase            text        check (fase is null or fase in ('armado', 'instalacion')),

  -- Unidad de medida del ítem.
  unidad          text        not null check (unidad in ('m2', 'ml', 'unidad')),

  descripcion     text        not null,

  -- Precio en centavos enteros, igual que el resto de la app.
  precio_cents    integer     not null check (precio_cents >= 0),

  -- Inactivar en vez de borrar: conserva la tarifa histórica que ya se
  -- usó en movimientos pasados.
  activo          boolean     not null default true,

  -- Orden manual de despliegue en el selector (Agregar Movimiento).
  orden           integer     not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Pintor => sin fase; ebanista => fase obligatoria (armado/instalación).
  constraint labor_rates_fase_matches_type
    check (
      (contractor_type = 'pintor'   and fase is null)
      or
      (contractor_type = 'ebanista' and fase is not null)
    )
);

comment on table public.labor_rates is
  'Catálogo de tarifas de mano de obra (ebanistas y pintores) para armar ítems de trabajo en el ledger de contratistas. Solo-admin; costos internos, no visibles para vendedor.';

create index idx_labor_rates_type_activo_orden
  on public.labor_rates (contractor_type, activo, orden);

alter table public.labor_rates enable row level security;

-- ============================================================================
-- 2. updated_at — trigger reutilizando el helper de la Fase 1
-- ============================================================================
create trigger labor_rates_touch_updated_at
  before update on public.labor_rates
  for each row execute function private.touch_updated_at();

-- ============================================================================
-- 3. RLS — solo admin (mismo patrón y helper que Planilla / Contratistas)
-- ============================================================================
create policy "labor_rates_admin_all"
  on public.labor_rates for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ============================================================================
-- 4. Grants — anon nada; authenticated queda filtrado por RLS
-- ============================================================================
revoke all on public.labor_rates from anon;
grant select, insert, update, delete on public.labor_rates to authenticated;

-- ============================================================================
-- 5. Seed — 14 tarifas iniciales (pintores + ebanistas armado/instalación)
-- ============================================================================
insert into public.labor_rates (contractor_type, fase, unidad, descripcion, precio_cents, orden) values
  ('pintor',   null,          'm2',     'M² pintado liso',                                     4700, 1),
  ('pintor',   null,          'm2',     'M² pintado chapilla',                                 5200, 2),
  ('pintor',   null,          'ml',     'ML tubo',                                              1300, 3),
  ('pintor',   null,          'unidad', 'Módulos pequeños',                                    1000, 4),
  ('pintor',   null,          'unidad', 'Módulos grandes',                                      1500, 5),
  ('pintor',   null,          'm2',     'M² tablillas metálicas',                               4700, 6),
  ('ebanista', 'armado',      'm2',     'Módulo mueble',                                        7600, 7),
  ('ebanista', 'instalacion', 'm2',     'Módulo mueble',                                        3400, 8),
  ('ebanista', 'armado',      'm2',     'Revestimiento liso',                                   4000, 9),
  ('ebanista', 'instalacion', 'm2',     'Revestimiento liso',                                   2000, 10),
  ('ebanista', 'armado',      'unidad', 'Puerta (70 cm a 1 mt) – Pivote, bisagra o corredera',   8500, 11),
  ('ebanista', 'instalacion', 'unidad', 'Puerta (70 cm a 1 mt) – Pivote, bisagra o corredera',   6500, 12),
  ('ebanista', 'armado',      'unidad', 'Puerta (1.20 a 2 mt) – Pivote, bisagra o corredera',   13500, 13),
  ('ebanista', 'instalacion', 'unidad', 'Puerta (1.20 a 2 mt) – Pivote, bisagra o corredera',    9500, 14);
