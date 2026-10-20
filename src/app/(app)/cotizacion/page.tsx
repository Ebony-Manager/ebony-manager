import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getQuoteSummaries } from "@/services/cotizador";
import { QuotesList } from "./quotes-list";

// Lista de cotizaciones. `force-dynamic` porque cambia por acción del
// usuario y no debe cachearse entre requests.
export const dynamic = "force-dynamic";

export default async function CotizacionPage() {
  const profile = await requireModule("cotizacion");
  const quotes = await getQuoteSummaries();
  return <QuotesList initialQuotes={quotes} canEditCosts={hasModule(profile, "costos")} />;
}
