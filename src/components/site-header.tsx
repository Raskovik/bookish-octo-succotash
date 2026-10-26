import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isConversationUnread } from "@/lib/dm-unread";
import { SiteNav } from "@/components/site-nav";
import type { NotificationWithActor } from "@/lib/supabase/types";

const NOTIFICATION_LIMIT = 20;

/**
 * Matches furgarden-design/partials/site-header.html: a single
 * <header class="hero"> containing the .scene player/wallet card and
 * the <nav class="cnav"> (rendered here by SiteNav, nested inside this
 * header — not a sibling — exactly like the partial). This is the sole
 * data fetch for the whole header; SiteNav is purely presentational.
 *
 * Left out for lack of real data (see the README's "Known placeholders"
 * section, which already anticipates some of this not being finished):
 * the .hangtab announcement banner, the .meter level-progress bar (no
 * player-level/XP system exists), and {{online_count}} (dropped in
 * SiteNav, not here).
 */
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <header className="hero">
        <div className="scene">
          <div />
          <Link className="wordmark" href="/" title="Clicking this returns player to home">
            Furgarden
          </Link>
          <div className="walletcard" style={{ display: "grid", placeItems: "center" }}>
            <Link className="btn" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const [{ data: profile }, { data: conversationsData }, { data: notificationRows }] = await Promise.all([
    supabase
      .from("users")
      .select("display_name, avatar_url, coin_balance, gem_balance, is_admin, is_moderator")
      .eq("id", user.id)
      .single(),
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

  return (
    <header className="hero">
      <div className="scene">
        <div className="player">
          <Link href={`/u/${user.id}`}>
            <div
              className="av"
              role="img"
              aria-label="Your avatar"
              style={profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
            />
          </Link>
          <div>
            <p className="pname">
              <Link href={`/u/${user.id}`}>{profile?.display_name ?? "Player"}</Link>
              <small>Welcome back!</small>
            </p>
          </div>
        </div>

        <Link className="wordmark" href="/" title="Clicking this returns player to home">
          Furgarden
        </Link>

        <ul className="walletcard" aria-label="Your balances">
          <li>
            <span className="coin" />
            Coins
            <b>{profile?.coin_balance ?? 0}</b>
          </li>
          <li>
            <span className="coin gem" />
            Gems
            <b>{profile?.gem_balance ?? 0}</b>
          </li>
        </ul>
      </div>

      <SiteNav
        isAdmin={profile?.is_admin ?? false}
        isModerator={profile?.is_moderator ?? false}
        unreadDmCount={unreadDmCount}
        notifications={notifications}
      />
    </header>
  );
}
