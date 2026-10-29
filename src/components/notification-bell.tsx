"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { describeNotification } from "@/lib/notification-message";
import {
  markAllNotificationsRead,
  markNotificationRead,
  clearNotification,
  clearAllNotifications,
} from "@/lib/notification-actions";
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
 * tray, but — unlike NavGroups — manages its own open/closed state in
 * React instead of relying on furgarden.js's global .has-menu click
 * handling: that handling drives visibility off an "is-open" class it
 * adds/removes outside React's knowledge, and this component's own
 * state updates (marking an item read, clearing it) made the tray's
 * open/closed state fight with that class across re-renders — visibly,
 * the tray would collapse the instant a notification was clicked. So
 * this deliberately opts out of the `.has-menu` wiring (a different
 * wrapper class, not `.has-menu`, so furgarden.js's `.has-menu > button`
 * selector never matches it) and owns open/close + aria-expanded +
 * click-outside/Escape itself, same pattern as ThreadAdminControls'
 * popover.
 */
export function NotificationBell({
  initialNotifications,
}: {
  initialNotifications: NotificationWithActor[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

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

  function handleClear(id: string) {
    setNotifications((list) => list.filter((n) => n.id !== id));
    startTransition(() => {
      clearNotification(id);
    });
  }

  function handleClearAll() {
    setNotifications([]);
    startTransition(() => {
      clearAllNotifications();
    });
  }

  return (
    <div className="notif-menu" ref={containerRef}>
      <button
        className="btn btn-round"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} new` : "Notifications, none new"}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="ic i-bell" aria-hidden="true" />
        {unreadCount > 0 ? <span className="pip">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      {open ? (
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
                <div key={notification.id} className="note-row">
                  <Link
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
                  <button
                    type="button"
                    className="note-clear"
                    aria-label="Clear this notification"
                    title="Clear this notification"
                    onClick={() => handleClear(notification.id)}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          {notifications.length > 0 ? (
            <div className="tray-foot">
              {unreadCount > 0 ? (
                <button className="btn btn-sm btn-cream" type="button" onClick={handleMarkAllRead}>
                  Mark all read
                </button>
              ) : (
                <span />
              )}
              <button className="btn btn-sm btn-cream" type="button" onClick={handleClearAll}>
                Clear all
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
