import { requireModule } from "@/lib/auth/dal";
import { getTallerPainters, getTallerPeople, getTallerProjects, getVeneerTypes, getWorkOrder, getWorkOrders, withProjectNames } from "@/services/taller";
import { TallerView } from "./taller-view";

// Taller → Trabajos (CNC y muestras de pintura). El historial de colores está en /taller/colores y la configuración del
// formulario de muestras en Settings → Formularios. Ver TALLER-PLAN.md.
export const dynamic = "force-dynamic";

export default async function TallerPage({ searchParams }: { searchParams: Promise<{ trabajo?: string }> }) {
  const profile = await requireModule("taller");
  const [{ trabajo }, people, projects, rawOrders, painters, veneers] = await Promise.all([
    searchParams,
    getTallerPeople(),
    getTallerProjects(),
    getWorkOrders(),
    getTallerPainters(),
    getVeneerTypes(),
  ]);
  const orders = withProjectNames(rawOrders, projects);
  // Un enlace a un trabajo que ya salió del tablero (cerrado hace tiempo): se trae aparte para poder abrirlo.
  const missing = trabajo && !orders.some((o) => o.id === trabajo) ? await getWorkOrder(trabajo).catch(() => null) : null;
  const extraOrders = missing ? withProjectNames([missing], projects) : [];
  const me = people.find((p) => p.userId === profile.id) ?? null;
  return (
    <TallerView
      data={{ orders, people, projects, meEmployeeId: me?.employeeId ?? null, meUserId: profile.id, painters, veneers, extraOrders, isAdmin: profile.role === "admin" }}
      initialOpenId={trabajo ?? null}
    />
  );
}
