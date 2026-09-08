import { requireAdmin } from "@/lib/auth/dal";
import { getContractorsWithBalance } from "@/services/contractors";
import { ContratistasClient } from "./contratistas-client";

// El módulo de Contratistas es solo-admin. `requireAdmin()` rebota a un
// no-admin (a /cotizacion) antes de cargar nada; la RLS admin-only de
// las tablas es la última línea. `force-dynamic` porque los datos
// cambian por acción del usuario y no deben cachearse entre requests.
export const dynamic = "force-dynamic";

export default async function ContratistasPage() {
  await requireAdmin();
  const contractors = await getContractorsWithBalance();

  return <ContratistasClient contractors={contractors} />;
}
