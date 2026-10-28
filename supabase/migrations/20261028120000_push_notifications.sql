-- Suscripciones Web Push por usuario/dispositivo. Cada usuario administra
-- únicamente las suyas; el envío usa la service role desde el servidor.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create or replace trigger push_subscriptions_touch_updated_at before update on public.push_subscriptions
  for each row execute function private.touch_updated_at();

alter table public.app_notifications add column if not exists push_sent_at timestamptz;
create index if not exists app_notifications_push_pending_idx
  on public.app_notifications (created_at) where push_sent_at is null;

-- Leído por usuario: abrir el buzón de un admin no borra el indicador de los demás.
create table if not exists public.app_notification_reads (
  notification_id uuid not null references public.app_notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
alter table public.app_notification_reads enable row level security;
drop policy if exists "app_notification_reads_own" on public.app_notification_reads;
create policy "app_notification_reads_own" on public.app_notification_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.app_notification_reads from anon;
grant select, insert, update on public.app_notification_reads to authenticated;
