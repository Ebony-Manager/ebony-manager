import { requireModule } from "@/lib/auth/dal";
import { getTallerPainters, getTallerPeople, getTallerProjects, getVeneerTypes, getWorkOrders, withProjectNames } from "@/services/taller";
import { TallerView } from "./taller-view";

// Taller → Trabajos (CNC y muestras de pintura), Colores, Pintores y chapillas. Ver TALLER-PLAN.md.
export const dynamic = "force-dynamic";

export default async function TallerPage({ searchParams }: { searchParams: Promise<{ trabajo?: string; vista?: string }> }) {
  const profile = await requireModule("taller");
  const [{ trabajo, vista }, people, projects, rawOrders, rawSamples, painters, veneers] = await Promise.all([
    searchParams,
    getTallerPeople(),
    getTallerProjects(),
    getWorkOrders(),
    getWorkOrders({ kind: "muestra" }),
    getTallerPainters(),
    getVeneerTypes(),
  ]);
  const orders = withProjectNames(rawOrders, projects);
  const colorOrders = withProjectNames(rawSamples, projects);
  const me = people.find((p) => p.userId === profile.id) ?? null;
  return (
    <TallerView
      data={{ orders, people, projects, meEmployeeId: me?.employeeId ?? null, meUserId: profile.id, painters, veneers, colorOrders }}
      initialOpenId={trabajo ?? null}
      initialView={vista}
    />
  );
}
