import { requireAdmin } from "@/lib/auth/dal";
import { getAppUsers } from "@/services/app-users";
import { getNotices, getNotificationSettings } from "@/services/notifications";
import { NotificacionesClient } from "./notificaciones-client";

// Settings → Notificaciones: los avisos de la app (ej. alguien ajustó la
// asistencia) y los correos automáticos (el resumen diario del Almacén).
// Solo admin; la RLS repite la regla.
export const dynamic = "force-dynamic";

export default async function NotificacionesPage() {
  await requireAdmin();
  const [settings, users, notices] = await Promise.all([getNotificationSettings(), getAppUsers(), getNotices().catch(() => [])]);
  return <NotificacionesClient settings={settings} users={users} notices={notices} />;
}
