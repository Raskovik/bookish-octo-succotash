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
