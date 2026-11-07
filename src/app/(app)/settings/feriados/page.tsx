import { requireAdmin } from "@/lib/auth/dal";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { getHolidaysOfYear } from "@/services/holidays";
import { FeriadosClient } from "./feriados-client";

// Settings → Feriados: la lista que usa asistencia (feriados.io + días a mano).
// Solo admin; la RLS de `holidays` repite la regla.
export const dynamic = "force-dynamic";

export default async function FeriadosPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requireAdmin();
  const current = Number(todayInPanama().slice(0, 4));
  const asked = Number((await searchParams).anio);
  const year = Number.isInteger(asked) && asked >= current - 1 && asked <= current + 1 ? asked : current;
  const holidays = await getHolidaysOfYear(year);
  return <FeriadosClient year={year} currentYear={current} holidays={holidays} hasApiKey={!!process.env.FERIADOS_API_KEY?.trim()} />;
}
