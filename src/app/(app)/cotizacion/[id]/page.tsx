import { notFound } from "next/navigation";

import { requireProfile } from "@/lib/auth/dal";
import { defaultsFromInputs } from "@/lib/cotizador/pricing";
import { getCatalog, getCostInputs, getQuote } from "@/services/cotizador";
import { QuoteEditor } from "./quote-editor";

// Cotizar es para cualquier usuario de la app; el gate de `(app)/layout`
// ya exigió sesión y la RLS de `quote_*` es la última línea.
// `force-dynamic`: la cotización cambia por acción del usuario.
export const dynamic = "force-dynamic";

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const profile = await requireProfile();
  const [{ id }, { item }] = await Promise.all([params, searchParams]);

  const [quote, catalog, inputs] = await Promise.all([getQuote(id), getCatalog(), getCostInputs()]);
  if (!quote) notFound();

  return <QuoteEditor initialQuote={quote} catalog={catalog} defaults={defaultsFromInputs(inputs)} isAdmin={profile.role === "admin"} initialSectionId={item ?? null} />;
}
