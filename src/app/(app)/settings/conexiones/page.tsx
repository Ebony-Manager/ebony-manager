import { requireAdmin } from "@/lib/auth/dal";
import { driveEnabled } from "@/lib/google/drive";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

async function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}
import { alegraConfigured } from "@/lib/alegra/api";
import { getAlegraConfig } from "@/services/alegra";
import { ConexionesClient, type ConnectionsData } from "./conexiones-client";

// Settings → Conexiones: los servicios externos de los que depende la app,
// si están configurados y cuándo funcionaron o fallaron por última vez.
// Nunca muestra claves: solo si están puestas. Solo admin.
export const dynamic = "force-dynamic";

export default async function ConexionesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [runs, jotform, pending, alegraConfig] = await Promise.all([
    supabase.from("integration_runs").select("key, last_ok_at, last_detail, last_error_at, last_error"),
    supabase.rpc("jotform_last_activity"),
    supabase.from("holidays").select("date", { count: "exact", head: true }).eq("status", "pendiente"),
    getAlegraConfig(),
  ]);
  const has = (k: string) => !!process.env[k]?.trim();
  const data: ConnectionsData = {
    runs: Object.fromEntries((runs.data ?? []).map((r) => [r.key, r])),
    jotform: Object.fromEntries((jotform.data ?? []).map((r) => [r.form, r.last_at])),
    holidaysPending: pending.count ?? 0,
    env: {
      jotform: has("JOTFORM_API_KEY"),
      drive: driveEnabled(),
      feriados: has("FERIADOS_API_KEY"),
      cron: has("CRON_SECRET"),
      alegra: alegraConfigured(),
    },
    alegraConfig,
    mcpUrl: `${await siteOrigin()}/api/mcp`,
    missingTable: !!runs.error,
  };
  return <ConexionesClient data={data} />;
}
