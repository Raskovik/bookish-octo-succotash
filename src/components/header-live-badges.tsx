"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isConversationUnread } from "@/lib/dm-unread";
import { NotificationBell } from "@/components/notification-bell";
import type { NotificationWithActor } from "@/lib/supabase/types";

const NOTIFICATION_LIMIT = 20;
// There's no realtime wired up anywhere in this app (see NotificationBell's
// own comment) — this is a lightweight poll instead, which is enough to
// turn "only updates when you happen to navigate somewhere" into "shows
// up within half a minute," without standing up a Postgres changes
// subscription for what's still a hobby-project scale of traffic.
const POLL_INTERVAL_MS = 15000;

/**
 * Owns the two "did something happen while I was sitting on this page"
 * indicators in the header — the Messages mail icon's unread-DM pip and
 * the notification bell — and polls for both together so they don't
 * drift against each other. SiteHeader still does the first, fast,
 * server-rendered fetch for both (passed in as the `initial*` props);
 * this only takes over once mounted, replacing that fetch's cutoff
 * (page load only) with a background poll's (every POLL_INTERVAL_MS,
 * as long as you're on the site at all).
 */
export function HeaderActivity({
  userId,
  initialUnreadDmCount,
  initialNotifications,
}: {
  userId: string;
  initialUnreadDmCount: number;
  initialNotifications: NotificationWithActor[];
}) {
  const [unreadDmCount, setUnreadDmCount] = useState(initialUnreadDmCount);
  const [notifications, setNotifications] = useState(initialNotifications);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function refresh() {
      const [{ data: conversations }, { data: notificationRows }] = await Promise.all([
        supabase
          .from("dm_conversations")
          .select("user_one_id, last_message_at, last_message_sender_id, user_one_last_read_at, user_two_last_read_at")
          .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`),
        supabase
          .from("notifications")
          .select("id, user_id, type, actor_id, target_label, link, is_read, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(NOTIFICATION_LIMIT),
      ]);
      if (cancelled) return;

      setUnreadDmCount((conversations ?? []).filter((c) => isConversationUnread(c, userId)).length);

      const rows = notificationRows ?? [];
      const actorIds = [...new Set(rows.map((n) => n.actor_id).filter((id): id is string => id !== null))];
      const { data: actors } =
        actorIds.length > 0
          ? await supabase.from("user_profiles").select("id, display_name, is_admin, is_moderator").in("id", actorIds)
          : { data: [] };
      if (cancelled) return;

      const actorById = new Map((actors ?? []).map((a) => [a.id, a]));
      setNotifications(
        rows.map((n) => {
          const actor = n.actor_id ? actorById.get(n.actor_id) : undefined;
          return {
            ...n,
            actorName: actor?.display_name ?? null,
            actorIsAdmin: actor?.is_admin ?? false,
            actorIsModerator: actor?.is_moderator ?? false,
          };
        }),
      );
    }

    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  return (
    <>
      <Link
        className="btn btn-round"
        href="/messages"
        aria-label={unreadDmCount > 0 ? `Messages, ${unreadDmCount} unread` : "Messages"}
      >
        <i className="ic i-mail" aria-hidden="true" />
        {unreadDmCount > 0 ? <span className="pip">{unreadDmCount > 9 ? "9+" : unreadDmCount}</span> : null}
      </Link>
      <NotificationBell notifications={notifications} onNotificationsChange={setNotifications} />
    </>
  );
}
