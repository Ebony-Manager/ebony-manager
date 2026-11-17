import { requireModule } from "@/lib/auth/dal";
import { getTallerPeople, getTallerProjects, getWorkOrders, withProjectNames } from "@/services/taller";
import { TallerView } from "./taller-view";

// Taller → Trabajos (por ahora CNC). Ver TALLER-PLAN.md.
export const dynamic = "force-dynamic";

export default async function TallerPage({ searchParams }: { searchParams: Promise<{ trabajo?: string }> }) {
  const profile = await requireModule("taller");
  const [{ trabajo }, people, projects, rawOrders] = await Promise.all([searchParams, getTallerPeople(), getTallerProjects(), getWorkOrders()]);
  const orders = withProjectNames(rawOrders, projects);
  const me = people.find((p) => p.userId === profile.id) ?? null;
  return (
    <TallerView
      data={{ orders, people, projects, meEmployeeId: me?.employeeId ?? null, meUserId: profile.id }}
      initialOpenId={trabajo ?? null}
    />
  );
}
