import { redirect } from "next/navigation";

// Planilla pasó a Personal → Pagos (Quincena, Préstamos, Historial…) y su
// resumen al Resumen de Personal: esta dirección vieja queda solo para que
// no se rompan enlaces guardados.
export default async function PlanillaRedirect({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if (tab === "dashboard") redirect("/personal?ver=empleados");
  redirect(tab ? `/personal/pagos?tab=${encodeURIComponent(tab)}` : "/personal/pagos?tab=quincena");
}
