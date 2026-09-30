"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { describeNotification } from "@/lib/notification-message";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notification-actions";
import type { NotificationWithActor } from "@/lib/supabase/types";

/**
 * The header's notification bell — separate from (not a replacement
 * for) the existing unread-DM badge next to it; this is a broader
 * activity feed (forum replies, trades, marketplace sales, bans, staff
 * reports) that happens to include DMs too. Page-load data only, no
 * realtime — the header already re-fetches on every navigation, same as
 * the DM badge. Click-outside-to-close dropdown, same pattern as
 * ThreadAdminControls.
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className="relative flex items-center border-l border-stone-900/20 pl-3 text-stone-900 hover:opacity-80"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded-md border border-green-300 bg-white text-left shadow-lg dark:border-stone-700 dark:bg-stone-950">
          <div className="flex items-center justify-between border-b border-green-100 px-3 py-2 dark:border-stone-800">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Notifications
            </span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-green-800 hover:underline dark:text-green-300"
              >
                Mark all as read
              </button>
            ) : null}
          </div>
          {notifications.length === 0 ? (
            <p className="p-4 text-sm italic text-stone-500">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-green-100 overflow-y-auto dark:divide-stone-800">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={notification.link}
                    onClick={() => handleItemClick(notification.id)}
                    className={`flex items-start gap-2 px-3 py-2.5 text-sm hover:bg-green-50 dark:hover:bg-stone-900 ${
                      notification.is_read
                        ? "text-stone-600 dark:text-stone-400"
                        : "font-medium text-stone-900 dark:text-stone-100"
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                        notification.is_read ? "" : "bg-green-700"
                      }`}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span>{describeNotification(notification)}</span>
                      <span className="text-xs text-stone-400">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
