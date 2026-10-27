import Link from "next/link";
import { TRADING_ENABLED, BREWING_ENABLED } from "@/lib/feature-flags";
import { NavGroups, type NavGroup } from "@/components/nav-groups";
import { NotificationBell } from "@/components/notification-bell";
import type { NotificationWithActor } from "@/lib/supabase/types";

/**
 * Matches furgarden-design/partials/site-header.html's <nav class="cnav">
 * (nested inside SiteHeader's <header class="hero">, per the partial).
 * Purely presentational — SiteHeader does the one data fetch for the
 * whole header and passes down what this needs. Drops {{online_count}}
 * (no such data exists) and keeps just the live clock in .stats; its
 * ticking is handled entirely by public/js/furgarden.js (any #clock
 * element), not React.
 */
export function SiteNav({
  isAdmin,
  isModerator,
  unreadDmCount,
  notifications,
}: {
  isAdmin: boolean;
  isModerator: boolean;
  unreadDmCount: number;
  notifications: NotificationWithActor[];
}) {
  const groups: NavGroup[] = [
    {
      label: "Play",
      links: [
        { href: "/expeditions", label: "Expeditions" },
        ...(BREWING_ENABLED ? [{ href: "/brewing", label: "Brewing" }] : []),
        { href: "/garden", label: "Garden" },
      ],
    },
    {
      label: "My Stuff",
      links: [
        { href: "/pets", label: "Pets" },
        { href: "/items", label: "Items" },
      ],
    },
    {
      label: "Trade",
      links: [
        { href: "/shop", label: "Shop" },
        { href: "/marketplace", label: "Marketplace" },
        ...(TRADING_ENABLED ? [{ href: "/trades", label: "Trades" }] : []),
      ],
    },
    {
      label: "Community",
      links: [
        { href: "/forums", label: "Forums" },
        { href: "/messages", label: "Messages" },
      ],
    },
    {
      label: "Account",
      links: [
        { href: "/profile", label: "Profile" },
        { href: "/settings", label: "Settings" },
        // Separate links, not one merged entry — a moderator who isn't
        // also an admin gets Mod Tools but must never see (or be able to
        // guess their way into) Admin. An admin gets both, since is_admin
        // satisfies both requireAdmin() and requireModerator().
        ...(isModerator || isAdmin ? [{ href: "/mod", label: "Mod Tools" }] : []),
        ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
      ],
    },
  ];

  return (
    <nav className="cnav" aria-label="Main">
      <div className="stats">
        <span>
          <i className="ic i-clock" aria-hidden="true" />
          <time id="clock" />
        </span>
      </div>
      <NavGroups groups={groups} />
      <div className="tools">
        <Link
          className="btn btn-round"
          href="/messages"
          aria-label={unreadDmCount > 0 ? `Messages, ${unreadDmCount} unread` : "Messages"}
        >
          <i className="ic i-mail" aria-hidden="true" />
          {unreadDmCount > 0 ? <span className="pip">{unreadDmCount > 9 ? "9+" : unreadDmCount}</span> : null}
        </Link>
        <NotificationBell initialNotifications={notifications} />
        <form action="/auth/sign-out" method="post">
          <button className="btn btn-sm btn-cream" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
