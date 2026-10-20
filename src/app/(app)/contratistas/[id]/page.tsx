import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { getContractor, getContractorLedger, getLaborRates, getProjects, getContractorPhotoUrls } from "@/services/contractors";
import { ContractorProfileView } from "../contractor-profile-view";

// La ficha del contratista pide el módulo `contratistas`, igual que el
// resto: `requireModule()` rebota a quien no lo tiene antes de cargar nada
// y la RLS de las tablas es la última línea. `force-dynamic` porque el
// estado de cuenta cambia por acción del usuario y no debe cachearse.
export const dynamic = "force-dynamic";

export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("contratistas");
  const { id } = await params;

  const contractor = await getContractor(id);
  if (!contractor) notFound();

  const [entries, projects, laborRates, photoUrls] = await Promise.all([
    getContractorLedger(id),
    getProjects(),
    getLaborRates(),
    getContractorPhotoUrls([contractor]),
  ]);

  return (
    <ContractorProfileView
      contractor={contractor}
      photoUrl={photoUrls[contractor.id] ?? null}
      initialEntries={entries}
      initialProjects={projects}
      laborRates={laborRates}
    />
  );
}
