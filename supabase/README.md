# Supabase — Ebony

Project: **Ebony** · ref `jdfkfbopecqvvyxherku` · region `us-east-1`

## migrations/

The `.sql` files here are the source of truth for the database schema, in
order by filename timestamp. There is **no local Supabase CLI linked yet**,
so migrations are applied to the remote project one of two ways:

- via the Supabase MCP (`apply_migration`), or
- pasted into the dashboard SQL editor.

If you later run `supabase link --project-ref jdfkfbopecqvvyxherku`, these
files are already in the layout `supabase db push` expects.

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

## Dashboard config that is NOT in these files

Auth provider settings are not SQL and must be set in the dashboard:

- **Auth → Providers → Google**: enabled, with the OAuth Client ID + Secret.
- **Auth → URL Configuration**:
  - Site URL: `https://ebony-manager.vercel.app`
  - Redirect URLs: `https://ebony-manager.vercel.app/**`, `http://localhost:3001/**`
