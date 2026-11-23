import { notFound } from "next/navigation";

import { requireAnyModule } from "@/lib/auth/dal";
import { getProjectItems } from "@/services/diseno";
import { getColorOptions, getHardwareItemOptions, getLaborRateOptions, getOrder, getOrderSummaries } from "@/services/produccion";
import { OrderView } from "./order-view";

// La orden de producción: se arma por partes (ítems y color, documentos, mano de obra, herrajes, reserva) y
// se envía a revisión cuando no falta nada.
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyModule("diseno", "proyectos", "contratistas");
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const [rates, hardware, colors, items, orders] = await Promise.all([
    getLaborRateOptions().catch(() => []),
    getHardwareItemOptions().catch(() => []),
    getColorOptions(order.projectId).catch(() => []),
    getProjectItems(order.projectId).catch(() => []),
    getOrderSummaries({ projectId: order.projectId }).catch(() => []),
  ]);
  const taken = new Set(orders.flatMap((o) => o.itemIds));
  const freeItems = items.filter((i) => i.stage === "aprobado" && !taken.has(i.id));
  return <OrderView order={order} rates={rates} hardwareItems={hardware} colors={colors} freeItems={freeItems} />;
}
