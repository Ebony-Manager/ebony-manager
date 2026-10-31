import { requireModule } from "@/lib/auth/dal";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { addDays, weekStart } from "@/lib/inspections/schedule";
import { getScheduleBoard } from "@/services/inspections";
import { ScheduleView } from "./schedule-view";

// Inspecciones → Programación: qué detalle atiende quién y qué día (una semana a la vez).
export const dynamic = "force-dynamic";

export default async function ProgramacionPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  await requireModule("inspecciones");
  const { semana } = await searchParams;
  const today = todayInPanama();
  const monday = weekStart(
    semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : today,
  );
  const board = await getScheduleBoard(
    monday,
    addDays(monday, 5),
    addDays(today, -30),
  );
  return <ScheduleView board={board} monday={monday} today={today} />;
}
