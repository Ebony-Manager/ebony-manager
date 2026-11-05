import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { defaultsFromInputs, newQuote } from "@/lib/cotizador/pricing";
import { getCatalog, getCostInputs, getQuote, getQuoteOwnerOptions, getQuoteSiblings } from "@/services/cotizador";
import { linkClients, linkOpportunity, linkProject } from "@/lib/cotizador/owner";
import { getClients } from "@/services/ventas";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
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
  searchParams: Promise<{ oportunidad?: string; proyecto?: string; cliente?: string }>;
}) {
  const profile = await requireModule("cotizacion");
  const [{ id }, { oportunidad, proyecto, cliente }] = await Promise.all([params, searchParams]);

  const isNew = id === NEW_QUOTE;
  const [saved, catalog, inputs, clients, owners, siblings] = await Promise.all([
    isNew ? null : getQuote(id),
    getCatalog(),
    getCostInputs(),
    getClients(),
    getQuoteOwnerOptions(),
    isNew ? [] : getQuoteSiblings(id),
  ]);
  const defaults = defaultsFromInputs(inputs);
  const blank = isNew ? newQuote(crypto.randomUUID(), crypto.randomUUID(), defaults, todayInPanama()) : null;
  // Nueva desde Seguimiento, desde la ficha de un proyecto o desde la de un cliente: ya amarrada.
  const fromOpp = blank && oportunidad ? owners.opportunities.find((o) => o.id === oportunidad) : undefined;
  const fromProject = blank && proyecto ? owners.projects.find((p) => p.id === proyecto) : undefined;
  const fromClient = blank && cliente ? clients.find((c) => c.id === cliente) : undefined;
  const owner = fromOpp
    ? linkOpportunity(fromOpp, clients)
    : fromProject
      ? linkProject(fromProject, clients)
      : fromClient
        ? linkClients({ designerId: fromClient.kind === "arquitecto" ? fromClient.id : null, designerContactId: null, clientId: fromClient.kind === "cliente" ? fromClient.id : null }, clients, "")
        : null;
  const quote = blank ? { ...blank, ...owner } : saved;
  if (!quote) notFound();

  return (
    <QuoteEditor
      initialQuote={quote}
      isNew={isNew}
      catalog={catalog}
      defaults={defaults}
      clients={clients}
      owners={owners}
      siblings={siblings}
      isAdmin={profile.role === "admin"}
      canEditCosts={hasModule(profile, "costos")}
    />
  );
}
