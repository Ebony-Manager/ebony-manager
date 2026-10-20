import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { defaultsFromInputs } from "@/lib/cotizador/pricing";
import { getCatalog, getCostInputs, getQuote } from "@/services/cotizador";
import { QuoteEditor } from "./quote-editor";

// Cotizar es para cualquier usuario de la app; el gate de `(app)/layout`
// ya exigió sesión y la RLS de `quote_*` es la última línea.
// `force-dynamic`: la cotización cambia por acción del usuario.
export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireModule("cotizacion");
  const { id } = await params;

  const [quote, catalog, inputs] = await Promise.all([getQuote(id), getCatalog(), getCostInputs()]);
  if (!quote) notFound();

  return <QuoteEditor initialQuote={quote} catalog={catalog} defaults={defaultsFromInputs(inputs)} canEditCosts={hasModule(profile, "costos")} />;
}
