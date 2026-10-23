import { notFound } from "next/navigation";

import { requireProfile } from "@/lib/auth/dal";
import { defaultsFromInputs } from "@/lib/cotizador/pricing";
import { getCatalog, getCostInputs, getQuote } from "@/services/cotizador";
import { hasPlanReaderKey } from "@/services/plan-reader";
import { PlanFlow } from "./plan-flow";

// Leer un plano puede tardar un par de minutos (planos de varias hojas):
// el action de lectura corre dentro de esta ruta, así que el límite de
// tiempo se sube acá.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const [quote, catalog, inputs] = await Promise.all([getQuote(id), getCatalog(), getCostInputs()]);
  if (!quote) notFound();

  return (
    <PlanFlow
      quoteId={quote.id}
      clientName={quote.clientName}
      defaultLocation={quote.sections[quote.sections.length - 1]?.location ?? ""}
      catalog={catalog}
      defaults={defaultsFromInputs(inputs)}
      hasKey={hasPlanReaderKey()}
      isAdmin={profile.role === "admin"}
    />
  );
}
