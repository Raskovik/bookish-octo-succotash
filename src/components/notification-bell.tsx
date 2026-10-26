"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { describeNotification } from "@/lib/notification-message";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notification-actions";
import type { NotificationType, NotificationWithActor } from "@/lib/supabase/types";

// Maps each real notification type to one of furgarden.css's tile
// color/icon combos (see its README: "Icon tiles ... t-orange | t-leaf
// | t-gold | blank = blue"). No type falls through to a made-up icon —
// anything not listed below gets the plain default tile.
const NOTIFICATION_TILE: Record<NotificationType, string> = {
  dm: "i-mail",
  forum_reply: "t-leaf i-chat",
  trade_offer: "t-orange i-swap",
  trade_response: "t-orange i-swap",
  marketplace_sold: "t-gold i-diamond",
  marketplace_expired: "t-gold i-diamond",
  ban_issued: "t-gold i-megaphone",
  report_filed: "t-gold i-megaphone",
};

/**
 * The header's notification bell — separate from (not a replacement
 * for) the unread-DM badge next to it; this is a broader activity feed
 * (forum replies, trades, marketplace sales, bans, staff reports) that
 * happens to include DMs too. Page-load data only, no realtime — the
 * header already re-fetches on every navigation, same as the DM badge.
 *
 * Matches furgarden-design/partials/site-header.html's notifications
 * tray. Unlike NavGroups, this can't be fully static: "mark as read"
 * has to persist to the database, not just toggle a CSS class. So this
 * stays a client component, but only for that — opening/closing the
 * tray itself is left to public/js/furgarden.js's global .has-menu
 * handling (no open/useState, no outside-click listener here). The
 * real mark-all-read button deliberately has no id="tray"/id="npip" or
 * data-markread — those hooks are what the script's own cosmetic-only
 * mark-read path keys off, which would race with React removing the
 * same badge node from the DOM a moment later; using plain onClick +
 * the existing server actions avoids that fight entirely, and the
 * .tray.all-read CSS (built for that script path) simply goes unused,
 * since the conditional rendering below does the same job.
 */
export function NotificationBell({
  initialNotifications,
}: {
  initialNotifications: NotificationWithActor[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handleMarkAllRead() {
    setNotifications((list) => list.map((n) => ({ ...n, is_read: true })));
    startTransition(() => {
      markAllNotificationsRead();
    });
  }

  function handleItemClick(id: string) {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    startTransition(() => {
      markNotificationRead(id);
    });
  }

  return (
    <div className="has-menu">
      <button
        className="btn btn-round"
        type="button"
        aria-haspopup="true"
        aria-expanded="false"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} new` : "Notifications, none new"}
      >
        <i className="ic i-bell" aria-hidden="true" />
        {unreadCount > 0 ? <span className="pip">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      <div className="tray" role="region" aria-label="Notifications">
        <div className="tray-head">
          Notifications
          {unreadCount > 0 ? <span className="count">{unreadCount} new</span> : null}
        </div>
        {notifications.length === 0 ? (
          <p className="tray-empty">No notifications yet.</p>
        ) : (
          <div className="notes">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.link}
                onClick={() => handleItemClick(notification.id)}
                className={notification.is_read ? "note" : "note unread"}
              >
                <span className={`tile ${NOTIFICATION_TILE[notification.type]}`} />
                <div>
                  <p>{describeNotification(notification)}</p>
                  <time>{new Date(notification.created_at).toLocaleString()}</time>
                </div>
              </Link>
            ))}
          </div>
        )}
        {unreadCount > 0 ? (
          <div className="tray-foot">
            <button className="btn btn-sm btn-cream" type="button" onClick={handleMarkAllRead}>
              Mark all read
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
