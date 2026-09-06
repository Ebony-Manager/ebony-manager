import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth/dal";

/**
 * Auth gate for every real module route. Server-side now: `requireProfile`
 * verifies the Supabase session against the Auth server and redirects to
 * /login when there's none (proxy.ts already did an optimistic redirect;
 * this is the authoritative check). Pages that expose data still rely on
 * Postgres RLS as the last line — this layout is not the only defense.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();

  return <AppShell>{children}</AppShell>;
}
