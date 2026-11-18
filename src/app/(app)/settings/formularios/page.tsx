import { requireAdmin } from "@/lib/auth/dal";
import { getTallerPainters, getVeneerTypes } from "@/services/taller";
import { FormulariosClient } from "./formularios-client";

// Settings → Formularios: las listas y reglas de cada formulario de la app (por ahora, muestras de pintura).
// Solo admin; la RLS de cada tabla repite su regla.
export const dynamic = "force-dynamic";

export default async function FormulariosPage() {
  await requireAdmin();
  const [painters, veneers] = await Promise.all([getTallerPainters(), getVeneerTypes()]);
  return <FormulariosClient painters={painters} veneers={veneers} />;
}
