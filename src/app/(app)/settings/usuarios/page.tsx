import { requireAdmin } from "@/lib/auth/dal";
import { getAccessCandidates, getAppUsers } from "@/services/app-users";
import { UsuariosClient } from "./usuarios-client";

// Settings → Usuarios: solo-admin. `requireAdmin()` rebota a los demás
// (a su módulo de inicio) y la RLS de `allowed_emails` es la última línea.
// `force-dynamic` porque la lista cambia por acción del usuario.
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const me = await requireAdmin();
  const [users, candidates] = await Promise.all([getAppUsers(), getAccessCandidates()]);
  return <UsuariosClient users={users} candidates={candidates} myEmail={me.email} />;
}
