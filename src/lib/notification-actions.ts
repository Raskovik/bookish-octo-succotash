"use server";

import { createClient } from "@/lib/supabase/server";

// Backs the NotificationBell dropdown, which lives in the header rather
// than any one route — same reasoning as report-actions.ts living
// outside src/app/. Both RPCs (0044_notifications.sql) independently
// re-check auth.uid() = p_user_id, so these are a thin pass-through, not
// the real security boundary.
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("mark_notification_read", {
    p_user_id: user.id,
    p_notification_id: notificationId,
  });
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("mark_all_notifications_read", { p_user_id: user.id });
}

// Deletes rather than just marking read — 0052_clear_notifications.sql.
// Errors are logged (not surfaced to the player — NotificationBell's
// clear is optimistic/fire-and-forget like the read-marking actions
// above) so a failure, e.g. that migration not having been run against
// this environment's database yet, shows up in server logs instead of
// just quietly not sticking past the next refetch.
export async function clearNotification(notificationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.rpc("clear_notification", {
    p_user_id: user.id,
    p_notification_id: notificationId,
  });
  if (error) {
    console.error("clear_notification failed", notificationId, error);
  }
}

export async function clearAllNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.rpc("clear_all_notifications", { p_user_id: user.id });
  if (error) {
    console.error("clear_all_notifications failed", error);
  }
}
