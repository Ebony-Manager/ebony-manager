import { requireProfile } from "@/lib/auth/dal";
import { getNotices } from "@/services/notifications";
import { NotificationsInbox } from "./notifications-inbox";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireProfile();
  return <NotificationsInbox notices={await getNotices(200)} />;
}
