import { requireAnyModule } from "@/lib/auth/dal";
import { getStaffDirectory } from "@/services/staff-directory";
import { DocumentosClient } from "./documentos-client";

// Personal → Documentos: cédulas y contacto del personal, solo lectura y
// sin dinero. Entra quien tiene "Documentos del personal", Planilla o
// Contratistas; la base (`staff_directory()`) decide a quién ve cada uno.
export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  await requireAnyModule("documentos", "planilla", "contratistas");
  const people = await getStaffDirectory();
  return <DocumentosClient people={people} />;
}
