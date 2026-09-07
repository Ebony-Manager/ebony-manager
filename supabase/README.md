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
`20260906173300`, Fase 2 → `20260907010849`). When the CLI is finally linked,
reconcile once with `supabase migration repair`.

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

## Dashboard config that is NOT in these files

Auth provider settings are not SQL and must be set in the dashboard:

- **Auth → Providers → Google**: enabled, with the OAuth Client ID + Secret.
- **Auth → URL Configuration**:
  - Site URL: `https://ebony-manager.vercel.app`
  - Redirect URLs: `https://ebony-manager.vercel.app/**`, `http://localhost:3001/**`
