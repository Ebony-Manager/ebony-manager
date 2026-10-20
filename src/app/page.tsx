import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { homePathFor } from "@/lib/auth/modules";

/** Entrada de la app: el primer módulo al que tiene acceso quien entra. */
export default async function RootPage() {
  const profile = await requireProfile();
  redirect(homePathFor(profile));
}
