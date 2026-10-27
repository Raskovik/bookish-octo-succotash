import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { loadTrades } from "./load-trades";
import { TradeCard } from "./trade-card";

function HubCard({
  href,
  title,
  description,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-lg border border-green-200 p-4 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">{title}</span>
        {badge ? (
          <span className="rounded-full bg-green-800 px-2 py-0.5 text-xs font-medium text-white dark:bg-green-200 dark:text-green-950">
            {badge}
          </span>
        ) : null}
      </div>
      <span className="text-sm text-stone-500">{description}</span>
    </Link>
  );
}

export default async function TradingCenterPage() {
  if (!TRADING_ENABLED) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ count: incomingCount }, { count: outgoingCount }, { data: recentIdRows }] =
    await Promise.all([
      supabase
        .from("trades")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("status", "pending"),
      supabase
        .from("trades")
        .select("*", { count: "exact", head: true })
        .eq("initiator_id", user.id)
        .eq("status", "pending"),
      supabase
        .from("trades")
        .select("id")
        .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const recentTrades = await loadTrades(
    supabase,
    (recentIdRows ?? []).map((r) => r.id),
  );

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trading Center</h1>
        <p className="text-sm text-stone-500">
          Trade pets, items, coins, and gems with other players.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <HubCard
          href="/trades/active"
          title="Active trades"
          description="Offers waiting on you or a response from someone else."
          badge={(incomingCount ?? 0) + (outgoingCount ?? 0) || undefined}
        />
        <HubCard
          href="/trades/browse"
          title="Browse trades"
          description="See every pet and item other players have marked for trade."
        />
        <HubCard
          href="/trades/new"
          title="Propose a trade"
          description="Start a new trade with another player by username."
        />
        <HubCard
          href="/trades/history"
          title="Trade history"
          description="Completed, declined, and cancelled trades."
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {recentTrades.length === 0 ? (
          <p className="text-sm italic text-stone-500">No trades yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentTrades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} viewerId={user.id} />
            ))}
          </div>
        )}
      </section>
        </div>
      </div>
    </main>
  );
}
