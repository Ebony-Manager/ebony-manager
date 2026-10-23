import { requireAdmin } from "@/lib/auth/dal";
import { getAppUsers } from "@/services/app-users";
import { UsuariosClient } from "./usuarios-client";

// Settings → Usuarios: solo-admin. `requireAdmin()` rebota a los demás
// (a su módulo de inicio) y la RLS de `allowed_emails` es la última línea.
// `force-dynamic` porque la lista cambia por acción del usuario.
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const me = await requireAdmin();
  const users = await getAppUsers();
  return <UsuariosClient users={users} myEmail={me.email} />;
}
