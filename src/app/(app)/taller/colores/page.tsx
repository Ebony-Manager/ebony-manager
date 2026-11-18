import { requireModule } from "@/lib/auth/dal";
import { getTallerPainters, getTallerProjects, getVeneerTypes, getWorkOrders, withProjectNames } from "@/services/taller";
import { ColorsPage } from "./colors-page";

// Taller → Historial de colores: todas las muestras de pintura (no solo las recientes del tablero).
export const dynamic = "force-dynamic";

export default async function TallerColoresPage() {
  await requireModule("taller");
  const [orders, projects, painters, veneers] = await Promise.all([getWorkOrders({ kind: "muestra" }), getTallerProjects(), getTallerPainters(), getVeneerTypes()]);
  return <ColorsPage orders={withProjectNames(orders, projects)} painters={painters} veneers={veneers} />;
}
