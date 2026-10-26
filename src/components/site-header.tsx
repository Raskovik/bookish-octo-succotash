import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CURRENCY } from "@/config";

/**
 * The hero/"scene" banner — player identity card, wordmark logo, and
 * wallet, per the furgarden-theme.css reference. Mail/notifications/
 * sign-out moved to SiteNav's .tools (that's where the reference puts
 * them, grouped with the nav links rather than here).
 *
 * Two things the reference shows that this doesn't, for lack of real
 * data: the "hangtab" event banner (no event system exists to feed it —
 * inventing copy felt worse than leaving it off), and the player-card's
 * level/progress .meter (pets have levels now, players don't — nothing
 * to show a percentage of).
 */
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let coinBalance: number | null = null;
  let gemBalance: number | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("display_name, avatar_url, coin_balance, gem_balance")
      .eq("id", user.id)
      .single();
    displayName = profile?.display_name ?? null;
    avatarUrl = profile?.avatar_url ?? null;
    coinBalance = profile?.coin_balance ?? null;
    gemBalance = profile?.gem_balance ?? null;
  }

  return (
    <header className="hero">
      <div className="scene">
        {user ? (
          <div className="player">
            <Link href={`/u/${user.id}`}>
              <div
                className="av"
                style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
                role="img"
                aria-label="Your avatar"
              />
            </Link>
            <div>
              <p className="pname">
                <Link href={`/u/${user.id}`}>{displayName ?? "Player"}</Link>
                <small>Welcome back!</small>
              </p>
            </div>
          </div>
        ) : (
          <div />
        )}

        <Link className="wordmark" href="/" title="Clicking this returns player to home">
          Furgarden
        </Link>

        {user ? (
          <ul className="walletcard" aria-label="Your balances">
            <li>
              <span className="coin" />
              {CURRENCY.coin.label}
              <b>{coinBalance ?? 0}</b>
            </li>
            <li>
              <span className="coin gem" />
              {CURRENCY.gem.label}
              <b>{gemBalance ?? 0}</b>
            </li>
          </ul>
        ) : (
          <div className="justify-self-end">
            <Link className="btn" href="/login">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
