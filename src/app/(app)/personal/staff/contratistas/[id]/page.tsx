import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { getContractor, getContractorLedger, getLaborRates, getProjects, getContractorPhotoUrls } from "@/services/contractors";
import { parseContractorFrom } from "@/lib/personal/paths";
import { signedDocumentUrl } from "@/services/photos";
import { ContractorProfileView } from "@/app/(app)/contratistas/contractor-profile-view";

// Ficha del contratista, dentro de Personal → Staff. Pide el módulo
// `contratistas`, igual que el resto de Contratistas: `requireModule()`
// rebota a quien no lo tiene antes de cargar nada y la RLS de las tablas es
// la última línea. `force-dynamic` porque el
// estado de cuenta cambia por acción del usuario y no debe cachearse.
export const dynamic = "force-dynamic";

export default async function ContractorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireModule("contratistas");
  const { id } = await params;
  const { from } = await searchParams;

  const contractor = await getContractor(id);
  if (!contractor) notFound();

  const [entries, projects, laborRates, photoUrls, documentUrl] = await Promise.all([
    getContractorLedger(id),
    getProjects(),
    getLaborRates(),
    getContractorPhotoUrls([contractor]),
    signedDocumentUrl(contractor.idDocumentPath),
  ]);

  return (
    <ContractorProfileView
      contractor={contractor}
      photoUrl={photoUrls[contractor.id] ?? null}
      documentUrl={documentUrl}
      initialEntries={entries}
      initialProjects={projects}
      laborRates={laborRates}
      from={parseContractorFrom(from)}
    />
  );
}
