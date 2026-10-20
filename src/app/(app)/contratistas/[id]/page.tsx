import { redirect } from "next/navigation";

import { contractorProfilePath } from "@/lib/personal/paths";

// La ficha del contratista se mudó a Personal → Staff. Esta ruta queda solo
// para que los enlaces y marcadores viejos sigan funcionando.
export default async function OldContractorProfileRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(contractorProfilePath(id));
}
