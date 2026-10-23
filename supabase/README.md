# Supabase — Ebony

Project: **Ebony** · ref `jdfkfbopecqvvyxherku` · region `us-east-1`

## migrations/

The `.sql` files here are the source of truth for the database schema, in
order by filename timestamp. There is **no local Supabase CLI linked yet**,
so migrations are applied to the remote project one of two ways:

- via the Supabase MCP (`apply_migration`), or
- pasted into the dashboard SQL editor.

If you later run `supabase link --project-ref jdfkfbopecqvvyxherku`, these
files are already in the layout `supabase db push` expects. Note: applying via
the MCP stamps its own `version` in `supabase_migrations.schema_migrations`,
so the remote version does not match the local filename timestamp (Fase 1 →
`20260906173300`, Fase 2 planilla → `20260907010849`, Fase 2 salary history →
`20260907063931`, Fase 2 contractors → `20260908171225`). When the CLI is
finally linked, reconcile once with `supabase migration repair`.

### 20260906170000_fase1_auth_rls.sql

Fase 1 foundation:

- `public.profiles` — one row per user, `role` is `admin` | `vendedor`.
- `public.allowed_emails` — sign-in allow-list; non-listed Google accounts
  are rejected at signup by the `on_auth_user_created` trigger.
- Helper/trigger functions live in the `private` schema (not exposed by
  PostgREST). `private.is_admin()` drives the RLS policies.
- RLS is on for both tables; `anon` has no access.
- Seeds one bootstrap admin: `teofilohafeitz@gmail.com`. Add the rest of the
  team by inserting into `allowed_emails` (admin-only) once signed in.

### 20260906180000_fase2_planilla.sql

Fase 2 — Planilla (empleados asalariados por quincena). Applied via MCP as
remote version `20260907010849`.

- `public.payroll_employees` — trabajador asalariado de planilla. **Not** a
  user of the app, never hangs off `profiles`. (Named `payroll_employees`, not
  `employees`, so a future `contractors` / `contractor_*` module fits beside
  it.)
- `public.payroll_entries` — one row per employee per quincena; no stored
  total, it is computed in the service layer.
- `public.payroll_ledger_entries` — generic debt/payment ledger (préstamo,
  adelanto, herramienta, daño, seguro_social, carnet, otro).
- `public.payroll_loans` — préstamos/adelantos whose cuotas auto-apply to
  future quincenas.
- Money is integer cents (same as the Atlas source). `id` is `uuid`
  (`gen_random_uuid()`); calendar fields are `date`.
- RLS on for all four; **admin only** — one `*_admin_all` policy per table
  using `private.is_admin()`. `anon` has no access. Reuses the Fase 1
  `private.is_admin()` and `private.touch_updated_at()` helpers (not
  redefined). A `vendedor` sees nothing here.
- Ported from Atlas's Payroll module — see `docs/fase2-planilla-port.md`.

### 20260907120000_fase2_salary_history.sql

Fase 2 — Historial de sueldos / aumentos por fecha. Applied via MCP as remote
version `20260907063931`.

- `public.payroll_salary_changes` — one row per "from this quincena onward the
  monthly salary is X" (`effective_year` / `effective_month` / `effective_half`,
  not a free `date` — a raise always starts at the beginning of a quincena).
  The salary in effect for a given quincena is the most recent row whose
  effective quincena is `<=` it.
- `UNIQUE (employee_id, effective_year, effective_month, effective_half)` — one
  change per employee per quincena (upsert target); its index also serves the
  "salary in effect at quincena X" lookup, so there is no standalone
  `employee_id` index.
- `benefits_base_salary_cents` nullable — per-effective-range alternate base for
  Décimo/Vacación/Prima ("Acumulado a 500" case); NULL = same as
  `monthly_salary_cents`.
- Same security shape as the other four planilla tables (RLS on, one
  `payroll_salary_changes_admin_all` policy, `anon` revoked, `updated_at`
  trigger reuses `private.touch_updated_at()`).
- No data migration — the payroll tables are empty. The service layer inserts
  each employee's first row (effective from their start date) on create.
  Payroll formulas (13th month, vacation, seniority, loans) are unchanged.

### 20260907130000_fase2_contractors.sql

Fase 2 — Contratistas por proyecto (ebanistas y pintores), ETAPA 1 (esquema
solo). Applied via MCP as remote version `20260908171225`.

- `public.contractors` — directorio de ebanistas/pintores. **Not** app users,
  **not** `payroll_employees`. `contractor_type` ∈ `ebanista|pintor`;
  `status` ∈ `ACTIVE|INACTIVE` (same tokens as `payroll_employees.status`).
- `public.projects` — proyecto de Ebony, versión mínima (nombre, cliente,
  estado `ACTIVE|COMPLETED`, notas). ETAPA 2 le añade campos de contrato de
  forma aditiva.
- `public.contractor_ledger_entries` — estado de cuenta. Saldo **derivado**:
  `SUM(a_favor) − SUM(reduce)` sobre movimientos con
  `ebony_absorbs_material = false`; nunca guardado. `category` ∈ 9 valores ES
  (`trabajo|bono|extra|pago|prestamo|adelanto|material|gasto_operativo|ajuste`),
  `direction` ∈ `a_favor|reduce`. `amount_cents ≥ 0` (magnitud; el signo lo da
  `direction`). CHECK: `ebony_absorbs_material` solo con `category = 'material'`.
  FKs: `contractor_id` → contractors **ON DELETE CASCADE**; `project_id`
  (nullable) → projects **ON DELETE SET NULL**.
- Same security shape as the planilla tables (RLS on, one `*_admin_all` policy
  per table via `private.is_admin()`, `anon` revoked, `updated_at` trigger
  reuses `private.touch_updated_at()`). Helpers not redefined.
- No data migration — the three tables are empty. UI screens are ETAPA 1's next
  step (not built yet).

## Dashboard config that is NOT in these files

Auth provider settings are not SQL and must be set in the dashboard:

- **Auth → Providers → Google**: enabled, with the OAuth Client ID + Secret.
- **Auth → URL Configuration**:
  - Site URL: `https://ebony-manager.vercel.app`
  - Redirect URLs: `https://ebony-manager.vercel.app/**`, `http://localhost:3001/**`

### 20261013130000_fase1_cotizador.sql

Fase 1 — Cotizador. **Pendiente de aplicar** (se corre en el SQL Editor).

- `public.quote_cost_inputs` — insumos (láminas, canteo, pintura) y valores
  fijos de la empresa (utilidad, margen de subcontratos, credit card fee,
  ITBMS).
- `public.quote_catalog_items` — catálogo con el precio "para cotizar".
- `public.quote_item_recipes` — receta de costo de cada renglón (la "HOJA DE
  CALCULO oficial" del Excel). **Solo admin.**
- `public.quotes` → `public.quote_sections` → `public.quote_lines`.
- Dinero en `numeric`, no centavos: los precios unitarios del Excel traen más
  de dos decimales y redondearlos cambia los totales.
- RLS: cotizaciones para cualquier usuario de la app (admin o vendedor);
  catálogo e insumos los leen todos y solo los escribe el admin.
- Trae el seed del catálogo (63 renglones, 30 recetas, 24 insumos/valores).
- Tras aplicarla, regenerar `src/types/database.ts` (las tablas `quote_*` están
  escritas a mano mientras tanto).

### 20261023120000_fase1_cotizador_planos.sql

Fase 1 — Cotizador · lectura de planos. **Pendiente de aplicar.** Debe
aplicarse ANTES de desplegar el código que la usa (el editor guarda
`piece_ids` y `plan_id`).

- `public.quote_plans` — lectura de un plano: archivo, piezas (`PlanPiece[]`),
  respuestas del cuestionario y dudas. RLS igual que las cotizaciones.
- `quote_sections.plan_id` y `quote_lines.piece_ids` — de qué plano salió un
  ítem y qué piezas cubre cada renglón (resaltado y cobertura en el 3D).
- Catálogo: + "Soporte de tablilla" (`ac-sop-tab`).
- Storage: bucket privado `planos` (PDF/PNG/JPG/WEBP, 25 MB) con políticas
  para usuarios de la app.
