import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TRADING_ENABLED, BREWING_ENABLED } from "@/lib/feature-flags";
import { isConversationUnread } from "@/lib/dm-unread";
import { NavGroups, type NavGroup } from "@/components/nav-groups";
import { NotificationBell } from "@/components/notification-bell";
import { SiteClock } from "@/components/site-clock";
import type { NotificationWithActor } from "@/lib/supabase/types";

const NOTIFICATION_LIMIT = 20;

// The wood-plank .cnav bar: nav link groups (left of center, per the
// furgarden-theme.css reference's 3-column layout) plus .tools — mail,
// notifications, and sign-out, moved here from SiteHeader since that's
// where the reference groups them (with the nav links, not the player
// card). Mail/notification data-fetching moved here along with them.
export async function SiteNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: conversationsData }, { data: notificationRows }] = await Promise.all([
    supabase.from("users").select("is_admin, is_moderator").eq("id", user.id).single(),
    supabase
      .from("dm_conversations")
      .select("user_one_id, last_message_at, last_message_sender_id, user_one_last_read_at, user_two_last_read_at")
      .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`),
    supabase
      .from("notifications")
      .select("id, user_id, type, actor_id, target_label, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(NOTIFICATION_LIMIT),
  ]);

  const isAdmin = profile?.is_admin ?? false;
  const isModerator = profile?.is_moderator ?? false;
  const unreadDmCount = (conversationsData ?? []).filter((c) => isConversationUnread(c, user.id)).length;

  const rows = notificationRows ?? [];
  const actorIds = [...new Set(rows.map((n) => n.actor_id).filter((id): id is string => id !== null))];
  const { data: actors } =
    actorIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name, is_admin, is_moderator").in("id", actorIds)
      : { data: [] };
  const actorById = new Map((actors ?? []).map((a) => [a.id, a]));

  const notifications: NotificationWithActor[] = rows.map((n) => {
    const actor = n.actor_id ? actorById.get(n.actor_id) : undefined;
    return {
      ...n,
      actorName: actor?.display_name ?? null,
      actorIsAdmin: actor?.is_admin ?? false,
      actorIsModerator: actor?.is_moderator ?? false,
    };
  });

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
        <SiteClock />
      </div>

      <NavGroups groups={groups} />

      <div className="tools">
        <Link
          className="btn btn-round"
          href="/messages"
          aria-label={unreadDmCount > 0 ? `Messages (${unreadDmCount} unread)` : "Messages"}
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
