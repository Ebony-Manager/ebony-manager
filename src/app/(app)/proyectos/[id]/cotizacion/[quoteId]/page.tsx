import { notFound } from "next/navigation";

import { requireAnyModule } from "@/lib/auth/dal";
import { getDesignerQuote } from "@/services/project-designers";
import { DesignerQuoteView } from "./designer-quote-view";

// La cotización de un proyecto para una diseñadora: SIN precios. Los datos vienen de una función de la base
// que ya los quita (la diseñadora no tiene lectura sobre las tablas de cotizaciones). El admin y quien tiene
// Cotización usan /cotizacion/[id], que sí trae los precios.
export const dynamic = "force-dynamic";

export default async function DesignerQuotePage({ params }: { params: Promise<{ id: string; quoteId: string }> }) {
  await requireAnyModule("diseno");
  const { id, quoteId } = await params;
  const quote = await getDesignerQuote(quoteId);
  if (!quote || quote.projectId !== id) notFound();
  return <DesignerQuoteView projectId={id} quote={quote} />;
}
