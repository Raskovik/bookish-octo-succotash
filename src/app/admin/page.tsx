import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { Badge } from "@/components/admin/badges";
import { ResultsChart, type DailyResults } from "./results-chart";

const RESULTS_WINDOW_DAYS = 30;
const RECENT_CHANGES_COUNT = 5;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

async function loadDailyResults(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
): Promise<DailyResults[]> {
  const since = new Date(Date.now() - RESULTS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expeditions } = await supabase
    .from("expeditions")
    .select("id, resolves_at, coins_reward, xp_reward, pending_species_id")
    .eq("is_tutorial", false)
    .in("status", ["awaiting_claim", "completed"])
    .gte("resolves_at", since);

  const rows = expeditions ?? [];
  const expeditionIds = rows.map((r) => r.id);

  const { data: lootRows } =
    expeditionIds.length > 0
      ? await supabase
          .from("expedition_loot_items")
          .select("expedition_id, quantity")
          .in("expedition_id", expeditionIds)
      : { data: [] as { expedition_id: string; quantity: number }[] };

  const itemsByExpedition = new Map<string, number>();
  for (const loot of lootRows ?? []) {
    itemsByExpedition.set(loot.expedition_id, (itemsByExpedition.get(loot.expedition_id) ?? 0) + loot.quantity);
  }

  const byDay = new Map<string, DailyResults>();
  const today = new Date();
  for (let i = RESULTS_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, trips: 0, items: 0, friends: 0, coins: 0, xp: 0 });
  }

  for (const row of rows) {
    const key = dayKey(row.resolves_at);
    const bucket = byDay.get(key);
    if (!bucket) continue; // outside the window (shouldn't happen given the gte filter, but safe)
    bucket.trips += 1;
    bucket.items += itemsByExpedition.get(row.id) ?? 0;
    bucket.friends += row.pending_species_id ? 1 : 0;
    bucket.coins += row.coins_reward;
    bucket.xp += row.xp_reward;
  }

  return [...byDay.values()];
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const ACTION_LABEL: Record<string, { label: string; color: "green" | "blue" | "red" | "gray" }> = {
  insert: { label: "created", color: "green" },
  update: { label: "updated", color: "blue" },
  delete: { label: "deleted", color: "red" },
};

type RecentChange = {
  id: string;
  target: string;
  table: string;
  action: string;
  at: string;
};

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();

  const dailyResults = await loadDailyResults(supabase);

  const [
    { count: zoneCount },
    { count: itemCount },
    { count: speciesCount },
    { count: newsCount },
    { count: forumCategoryCount },
    { count: shopListingCount },
    { data: auditRows },
  ] = await Promise.all([
    supabase.from("zones").select("*", { count: "exact", head: true }),
    supabase.from("items").select("*", { count: "exact", head: true }),
    supabase.from("species").select("*", { count: "exact", head: true }),
    supabase.from("site_news_posts").select("*", { count: "exact", head: true }),
    supabase.from("forum_categories").select("*", { count: "exact", head: true }),
    supabase.from("shop_listings").select("*", { count: "exact", head: true }),
    supabase
      .from("admin_audit_log")
      .select("id, action_type, target_table, change_summary, created_at")
      .order("created_at", { ascending: false })
      .limit(RECENT_CHANGES_COUNT),
  ]);

  const cards = [
    { href: "/admin/zones", label: "Zones", count: zoneCount ?? 0 },
    { href: "/admin/items", label: "Items", count: itemCount ?? 0 },
    { href: "/admin/species", label: "Models", count: speciesCount ?? 0 },
    { href: "/admin/news", label: "Site news", count: newsCount ?? 0 },
    { href: "/admin/forums", label: "Forum categories", count: forumCategoryCount ?? 0 },
    { href: "/admin/shop-listings", label: "Shop listings", count: shopListingCount ?? 0 },
  ];

  const recentChanges: RecentChange[] = (auditRows ?? []).map((row) => {
    const summary = row.change_summary as { old?: { name?: string }; new?: { name?: string } } | null;
    const target = summary?.new?.name ?? summary?.old?.name ?? row.target_table;
    return { id: row.id, target, table: row.target_table, action: row.action_type, at: row.created_at };
  });

  return (
    <>
      <div className="crumbs">
        <span>Dashboard</span>
      </div>
      <div className="ph">
        <h1>Admin panel</h1>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>
        Pick a section on the left, or press <b>/</b> to jump to anything.
      </p>

      <div className="tiles">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="tile">
            <b>{card.count}</b>
            <span>{card.label}</span>
          </Link>
        ))}
      </div>

      <div className="two">
        <ResultsChart days={dailyResults} />

        <section className="card pad" aria-labelledby="recent-changes">
          <h2 id="recent-changes">Recent changes</h2>
          <ul className="act-list">
            {recentChanges.map((change) => {
              const meta = ACTION_LABEL[change.action] ?? { label: change.action, color: "gray" as const };
              return (
                <li key={change.id}>
                  <b>{change.target}</b> <Badge color={meta.color}>{meta.label}</Badge>
                  <small>
                    {change.table} · {timeAgo(change.at)}
                  </small>
                </li>
              );
            })}
            {recentChanges.length === 0 ? <li className="muted">No admin actions logged yet.</li> : null}
          </ul>
          <p style={{ margin: "10px 0 0" }}>
            <Link href="/admin/audit-log">See the full audit log →</Link>
          </p>
        </section>
      </div>
    </>
  );
}
