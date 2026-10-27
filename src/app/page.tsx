import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { homePathFor } from "@/lib/auth/modules";

/** Entrada de la app: Dashboard con las secciones permitidas para quien entra. */
export default async function RootPage() {
  await requireProfile();
  redirect(homePathFor());
}
