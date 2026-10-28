import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth/dal";
import { hasAnyModule } from "@/lib/auth/modules";
import { getUnseenNoticeCount } from "@/services/notifications";
import { getPendingCounts } from "@/services/money-requests";

/**
 * Auth gate for every real module route. Server-side now: `requireProfile`
 * verifies the Supabase session against the Auth server and redirects to
 * /login when there's none (proxy.ts already did an optimistic redirect;
 * this is the authoritative check). Pages that expose data still rely on
 * Postgres RLS as the last line — this layout is not the only defense.
 *
 * También trae cuántos "Nuevos registros" y "Solicitudes de dinero" esperan
 * revisión, para los indicadores rojos del menú (solo a quien ve Planilla o
 * Contratistas; la RLS de cada tabla repite la regla), y al admin cuántos
 * avisos no ha visto (Settings → Notificaciones).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const [counts, notices] = await Promise.all([
    hasAnyModule(profile, ["planilla", "contratistas"])
      ? getPendingCounts().catch(() => ({ moneyRequests: 0, intakes: 0 }))
      : { moneyRequests: 0, intakes: 0 },
    getUnseenNoticeCount().catch(() => 0),
  ]);
  const pending = { ...counts, notices };

  return <AppShell pending={pending}>{children}</AppShell>;
}
