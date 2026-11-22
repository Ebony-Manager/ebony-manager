import { requireAnyModule } from "@/lib/auth/dal";
import { getBoardItems } from "@/services/diseno";
import { getMyDesignerProjectIds } from "@/services/project-designers";
import { DesignBoard } from "./design-board";

// Diseño: el tablero de los ítems (muebles) por etapa, de todas las diseñadoras o solo los proyectos propios.
export const dynamic = "force-dynamic";

export default async function DisenoPage() {
  await requireAnyModule("diseno", "proyectos", "contratistas");
  const [items, mine] = await Promise.all([getBoardItems(), getMyDesignerProjectIds().catch(() => [])]);
  return <DesignBoard items={items} myProjectIds={mine} />;
}
