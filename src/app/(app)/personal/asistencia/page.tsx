import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { hasAnyModule, hasModule } from "@/lib/auth/modules";
import { AsistenciaClient } from "./asistencia-client";

// Personal → Asistencia, suelta: para quien tiene Asistencia sin Planilla ni
// Contratistas (ej. jefa de taller), así no ve la palabra "Pagos". Ponchadas
// y días por revisar, sin dinero. Quien ve Pagos la tiene ahí como pestaña.
export const dynamic = "force-dynamic";

export default async function AsistenciaPage() {
  const profile = await requireModule("asistencia");
  if (hasAnyModule(profile, ["planilla", "contratistas"])) redirect("/personal/pagos?tab=asistencia");
  return <AsistenciaClient canPayroll={hasModule(profile, "planilla")} />;
}
