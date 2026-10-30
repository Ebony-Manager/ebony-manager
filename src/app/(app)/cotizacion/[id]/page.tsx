import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { defaultsFromInputs, newQuote } from "@/lib/cotizador/pricing";
import { getCatalog, getCostInputs, getQuote } from "@/services/cotizador";
import { getOpportunityPrefill } from "@/services/ventas";
import { QuoteEditor } from "./quote-editor";

// Cotizar es para cualquier usuario de la app; el gate de `(app)/layout`
// ya exigió sesión y la RLS de `quote_*` es la última línea.
// `force-dynamic`: la cotización cambia por acción del usuario.
// `/cotizacion/nueva` abre una cotización en blanco que todavía no existe en
// la base: el editor la crea con el primer cambio (nada que guardar = nada guardado).
export const dynamic = "force-dynamic";

const NEW_QUOTE = "nueva";

// `?oportunidad=ID` (desde Seguimiento): la nueva sale con cliente, arquitecto
// y proyecto llenos, y queda ligada a esa oportunidad.
export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ oportunidad?: string }>;
}) {
  const profile = await requireModule("cotizacion");
  const [{ id }, { oportunidad }] = await Promise.all([params, searchParams]);

  const isNew = id === NEW_QUOTE;
  const [saved, catalog, inputs, prefill] = await Promise.all([
    isNew ? null : getQuote(id),
    getCatalog(),
    getCostInputs(),
    isNew && oportunidad ? getOpportunityPrefill(oportunidad) : null,
  ]);
  const defaults = defaultsFromInputs(inputs);
  const blank = isNew ? newQuote(crypto.randomUUID(), crypto.randomUUID(), defaults, new Date().toISOString().slice(0, 10)) : null;
  const quote = blank && prefill
    ? { ...blank, clientName: prefill.clientName, designerName: prefill.designerName, projectName: prefill.projectName, opportunityId: prefill.id }
    : (blank ?? saved);
  if (!quote) notFound();

  return (
    <QuoteEditor
      initialQuote={quote}
      isNew={isNew}
      catalog={catalog}
      defaults={defaults}
      canEditCosts={hasModule(profile, "costos")}
    />
  );
}
