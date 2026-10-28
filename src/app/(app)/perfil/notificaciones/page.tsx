import { requireProfile } from "@/lib/auth/dal";
import { hasModule, isAppModule } from "@/lib/auth/modules";
import { getMyPushPreferences, getNotificationTypes } from "@/services/notifications";
import { MyNotifications } from "./my-notifications";

export const dynamic = "force-dynamic";

export default async function MyNotificationsPage() {
  const profile = await requireProfile();
  const [types, mine] = await Promise.all([getNotificationTypes(), getMyPushPreferences(profile.id)]);
  return (
    <MyNotifications
      types={types.filter((type) => isAppModule(type.module) && hasModule(profile, type.module))}
      preferences={mine.preferences}
      deviceCount={mine.deviceCount}
    />
  );
}
