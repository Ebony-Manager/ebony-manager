import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getStaffPerson } from "@/services/staff-directory";
import { StaffReadOnlyProfile } from "../../staff-readonly-profile";
import {
  getContractor,
  getContractorAllocations,
  getContractorLedger,
  getContractorPhotoUrls,
  getContracts,
  getLaborRates,
  getProjects,
} from "@/services/contractors";
import { parseContractorFrom } from "@/lib/personal/paths";
import { signedDocumentUrl } from "@/services/photos";
import { ContractorProfileView } from "@/app/(app)/contratistas/contractor-profile-view";

// Ficha del contratista, dentro de Personal → Staff. Entra quien tiene el
// permiso Personal; la ficha completa (contratos, estado de cuenta) pide
// además `contratistas` — sin él se muestra la ficha sin dinero, que sale de
// `staff_people()`. La RLS de las tablas es la última línea. `force-dynamic` porque el
// estado de cuenta cambia por acción del usuario y no debe cachearse.
export const dynamic = "force-dynamic";

export default async function ContractorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const profile = await requireModule("documentos");
  const { id } = await params;
  if (!hasModule(profile, "contratistas")) {
    const person = await getStaffPerson("contractor", id);
    if (!person) notFound();
    return <StaffReadOnlyProfile person={person} />;
  }
  const { from } = await searchParams;

  const contractor = await getContractor(id);
  if (!contractor) notFound();

  const [entries, projects, laborRates, photoUrls, documentUrl, contracts, allocations] = await Promise.all([
    getContractorLedger(id),
    getProjects(),
    getLaborRates(),
    getContractorPhotoUrls([contractor]),
    signedDocumentUrl(contractor.idDocumentPath),
    getContracts({ contractorId: id }),
    getContractorAllocations(id),
  ]);

  return (
    <ContractorProfileView
      contractor={contractor}
      photoUrl={photoUrls[contractor.id] ?? null}
      documentUrl={documentUrl}
      initialEntries={entries}
      initialProjects={projects}
      initialContracts={contracts}
      initialAllocations={allocations}
      laborRates={laborRates}
      from={parseContractorFrom(from)}
    />
  );
}
