import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { getContractor, getContractorLedger, getLaborRates, getProjects } from "@/services/contractors";
import { ContractorProfileView } from "../contractor-profile-view";

// La ficha del contratista es solo-admin, igual que el resto del módulo:
// `requireAdmin()` rebota a un no-admin antes de cargar nada y la RLS
// admin-only de las tablas es la última línea. `force-dynamic` porque el
// estado de cuenta cambia por acción del usuario y no debe cachearse.
export const dynamic = "force-dynamic";

export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const contractor = await getContractor(id);
  if (!contractor) notFound();

  const [entries, projects, laborRates] = await Promise.all([
    getContractorLedger(id),
    getProjects(),
    getLaborRates(),
  ]);

  return (
    <ContractorProfileView
      contractor={contractor}
      initialEntries={entries}
      initialProjects={projects}
      laborRates={laborRates}
    />
  );
}
