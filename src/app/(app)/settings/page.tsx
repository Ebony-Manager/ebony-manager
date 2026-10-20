import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";

// Settings no tiene pantalla propia: lleva a su primer ítem. Hoy el único es
// Usuarios (solo admin); `requireAdmin()` rebota a los demás a su módulo.
export default async function SettingsPage() {
  await requireAdmin();
  redirect("/settings/usuarios");
}
