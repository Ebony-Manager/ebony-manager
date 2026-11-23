import { requireAnyModule } from "@/lib/auth/dal";
import { getBoardItems, getMyEmployeeId } from "@/services/diseno";
import { getMyDesignerProjectIds } from "@/services/project-designers";
import { getOrderSummaries } from "@/services/produccion";
import { DesignBoard } from "./design-board";

// Diseño: el tablero de los ítems (muebles) por etapa, de todas las diseñadoras o solo los proyectos propios.
export const dynamic = "force-dynamic";

export default async function DisenoPage() {
  await requireAnyModule("diseno", "proyectos", "contratistas");
  const [items, orders, mine, me] = await Promise.all([
    getBoardItems(),
    getOrderSummaries().catch(() => []),
    getMyDesignerProjectIds().catch(() => []),
    getMyEmployeeId().catch(() => null),
  ]);
  return <DesignBoard items={items} orders={orders} myProjectIds={mine} myEmployeeId={me} />;
}
