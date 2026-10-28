-- Cada usuario administra sus propias preferencias push. El administrador
-- conserva únicamente las reglas generales y los permisos de módulos.
drop policy if exists "notification_preferences_own_write" on public.user_notification_preferences;
drop policy if exists "notification_preferences_admin_all" on public.user_notification_preferences;
create policy "notification_preferences_own_write" on public.user_notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
