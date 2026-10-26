"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { describeNotification } from "@/lib/notification-message";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notification-actions";
import type { NotificationWithActor } from "@/lib/supabase/types";

/**
 * The header's notification bell — separate from (not a replacement
 * for) the existing unread-DM badge next to it; this is a broader
 * activity feed (forum replies, trades, marketplace sales, bans, staff
 * reports) that happens to include DMs too. Page-load data only, no
 * realtime — the header already re-fetches on every navigation, same as
 * the DM badge.
 *
 * Markup matches furgarden-theme.css's .tray (a wood-framed dropdown
 * off a .has-menu trigger) — same open/close-on-outside-click logic as
 * before, just restyled. Unlike the reference, every notification uses
 * one plain tile/icon rather than a type-to-color/icon mapping (swap
 * orange, chat leaf, star gold, etc.) — simpler, no per-type lookup
 * table to maintain. "See all" is dropped too: there's no standalone
 * all-notifications page to link it to yet, just this dropdown's own
 * list (capped at 20, same as before).
 */
export function NotificationBell({
  initialNotifications,
}: {
  initialNotifications: NotificationWithActor[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`has-menu${open ? " is-open" : ""}`}>
      <button
        className="btn btn-round"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
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
                <span className="tile">
                  <i className="ic i-bell" aria-hidden="true" />
                </span>
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
