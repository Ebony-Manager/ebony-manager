import { requireAdmin } from "@/lib/auth/dal";
import { getAppUsers } from "@/services/app-users";
import { getNotificationSettings } from "@/services/notifications";
import { NotificacionesClient } from "./notificaciones-client";

// Settings → Notificaciones: los avisos automáticos de la app (hoy, el
// resumen diario del Almacén). Solo admin; la RLS repite la regla.
export const dynamic = "force-dynamic";

export default async function NotificacionesPage() {
  await requireAdmin();
  const [settings, users] = await Promise.all([getNotificationSettings(), getAppUsers()]);
  return <NotificacionesClient settings={settings} users={users} />;
}
