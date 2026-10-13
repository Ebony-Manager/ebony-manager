import { requireProfile } from "@/lib/auth/dal";
import { getQuoteSummaries } from "@/services/cotizador";
import { QuotesList } from "./quotes-list";

// Lista de cotizaciones. `force-dynamic` porque cambia por acción del
// usuario y no debe cachearse entre requests.
export const dynamic = "force-dynamic";

export default async function CotizacionPage() {
  const profile = await requireProfile();
  const quotes = await getQuoteSummaries();
  return <QuotesList initialQuotes={quotes} isAdmin={profile.role === "admin"} />;
}
