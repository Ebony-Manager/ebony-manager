import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { defaultsFromInputs, newQuote } from "@/lib/cotizador/pricing";
import { getCatalog, getCostInputs, getQuote } from "@/services/cotizador";
import { QuoteEditor } from "./quote-editor";

// Cotizar es para cualquier usuario de la app; el gate de `(app)/layout`
// ya exigió sesión y la RLS de `quote_*` es la última línea.
// `force-dynamic`: la cotización cambia por acción del usuario.
// `/cotizacion/nueva` abre una cotización en blanco que todavía no existe en
// la base: el editor la crea con el primer cambio (nada que guardar = nada guardado).
export const dynamic = "force-dynamic";

const NEW_QUOTE = "nueva";

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const profile = await requireModule("cotizacion");
  const [{ id }, { item }] = await Promise.all([params, searchParams]);

  const isNew = id === NEW_QUOTE;
  const [saved, catalog, inputs] = await Promise.all([isNew ? null : getQuote(id), getCatalog(), getCostInputs()]);
  const defaults = defaultsFromInputs(inputs);
  const quote = isNew ? newQuote(crypto.randomUUID(), crypto.randomUUID(), defaults, new Date().toISOString().slice(0, 10)) : saved;
  if (!quote) notFound();

  return (
    <QuoteEditor
      initialQuote={quote}
      isNew={isNew}
      catalog={catalog}
      defaults={defaults}
      canEditCosts={hasModule(profile, "costos")}
      initialSectionId={item ?? null}
    />
  );
}
