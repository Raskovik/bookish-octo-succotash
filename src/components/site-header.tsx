import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isConversationUnread } from "@/lib/dm-unread";
import { CURRENCY } from "@/config";
import { CurrencyIcon } from "@/components/currency-icon";
import { NotificationBell } from "@/components/notification-bell";
import { iconButtonClassName, IconGloss } from "@/components/game-ui";
import type { NotificationWithActor } from "@/lib/supabase/types";

const NOTIFICATION_LIMIT = 20;

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let coinBalance: number | null = null;
  let gemBalance: number | null = null;
  let unreadCount = 0;
  let notifications: NotificationWithActor[] = [];

  if (user) {
    const [{ data: profile }, { data: conversationsData }, { data: notificationRows }] = await Promise.all([
      supabase
        .from("users")
        .select("display_name, avatar_url, coin_balance, gem_balance")
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
    displayName = profile?.display_name ?? null;
    avatarUrl = profile?.avatar_url ?? null;
    coinBalance = profile?.coin_balance ?? null;
    gemBalance = profile?.gem_balance ?? null;
    unreadCount = (conversationsData ?? []).filter((c) => isConversationUnread(c, user.id)).length;

    const rows = notificationRows ?? [];
    const actorIds = [...new Set(rows.map((n) => n.actor_id).filter((id): id is string => id !== null))];
    const { data: actors } =
      actorIds.length > 0
        ? await supabase.from("user_profiles").select("id, display_name, is_admin, is_moderator").in("id", actorIds)
        : { data: [] };
    const actorById = new Map((actors ?? []).map((a) => [a.id, a]));

    notifications = rows.map((n) => {
      const actor = n.actor_id ? actorById.get(n.actor_id) : undefined;
      return {
        ...n,
        actorName: actor?.display_name ?? null,
        actorIsAdmin: actor?.is_admin ?? false,
        actorIsModerator: actor?.is_moderator ?? false,
      };
    });
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
      {/* Logo placeholder — swap for real logo art later; the link-home
          behavior underneath won't need to change. Glossy wood-sign
          treatment matches GameButton's bevel, hand-styled rather than
          reused from there since GameButton only renders a <button>. */}
      <Link
        href="/"
        className="relative flex min-w-40 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border-2 border-amber-950 bg-gradient-to-b from-green-500 to-green-700 px-6 py-3 text-center text-white shadow-md transition hover:brightness-105"
      >
        <span className="pointer-events-none absolute inset-x-1.5 top-1 h-1/4 rounded-full bg-white/25" />
        <span className="relative text-sm font-bold uppercase tracking-wide">Logo image placeholder</span>
        <span className="relative text-xs opacity-90">Clicking this returns player to home</span>
      </Link>

      {user ? (
        <div className="wood-frame flex items-center gap-3 rounded-xl border-2 border-amber-950 px-4 py-2 shadow-md">
          <div className="flex items-center gap-2 rounded-full border border-amber-800 bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 shadow-inner">
            <span title={CURRENCY.coin.label}>
              <CurrencyIcon kind="coin" /> {coinBalance ?? 0}
            </span>
            <span title={CURRENCY.gem.label}>
              <CurrencyIcon kind="gem" /> {gemBalance ?? 0}
            </span>
          </div>
          <Link
            href="/messages"
            className={iconButtonClassName("neutral", "relative")}
            style={{ width: 34, height: 34 }}
            aria-label={unreadCount > 0 ? `Messages (${unreadCount} unread)` : "Messages"}
          >
            <IconGloss />
            <Mail size={17} className="relative" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-red-600 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>
          <NotificationBell initialNotifications={notifications} />
          <Link
            href="/profile"
            className="flex items-center gap-2 text-sm font-semibold text-white hover:underline"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt=""
                width={26}
                height={26}
                className="h-[26px] w-[26px] rounded-full border-2 border-amber-200"
              />
            ) : null}
            {displayName ?? "Profile"}
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="rounded-full border border-amber-200/40 px-2.5 py-1 text-xs font-medium text-amber-100 hover:bg-black/20"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <Link
          href="/login"
          className="relative overflow-hidden rounded-full border-2 border-amber-950 bg-gradient-to-b from-yellow-300 to-yellow-500 px-5 py-2.5 text-sm font-bold text-amber-950 shadow-md transition hover:brightness-105"
        >
          <span className="pointer-events-none absolute inset-x-1.5 top-1 h-1/3 rounded-full bg-white/40" />
          <span className="relative">Sign in</span>
        </Link>
      )}
    </header>
  );
}
