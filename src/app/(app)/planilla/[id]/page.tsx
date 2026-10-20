import { redirect } from "next/navigation";

import { employeeProfilePath, parseEmployeeFrom } from "@/lib/personal/paths";

// La ficha del empleado se mudó a Personal → Staff. Esta ruta queda solo
// para que los enlaces y marcadores viejos sigan funcionando.
export default async function OldEmployeeProfileRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  redirect(employeeProfilePath(id, parseEmployeeFrom(from)));
}
