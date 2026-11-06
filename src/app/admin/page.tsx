import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { BREWING_ENABLED, GARDEN_ENABLED } from "@/lib/feature-flags";
import { ResultsChart, type DailyResults } from "./results-chart";

const RESULTS_WINDOW_DAYS = 30;

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

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();

  const dailyResults = await loadDailyResults(supabase);

  const [
    { count: zoneCount },
    { count: itemCount },
    { count: speciesCount },
    { count: recipeCount },
    { count: newsCount },
    { count: forumCategoryCount },
    { count: gardenPlantCount },
    { count: shopListingCount },
  ] = await Promise.all([
    supabase.from("zones").select("*", { count: "exact", head: true }),
    supabase.from("items").select("*", { count: "exact", head: true }),
    supabase.from("species").select("*", { count: "exact", head: true }),
    BREWING_ENABLED
      ? supabase.from("potion_recipes").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
    supabase.from("site_news_posts").select("*", { count: "exact", head: true }),
    supabase.from("forum_categories").select("*", { count: "exact", head: true }),
    GARDEN_ENABLED
      ? supabase.from("garden_plants").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
    supabase.from("shop_listings").select("*", { count: "exact", head: true }),
  ]);

  const cards = [
    { href: "/admin/zones", label: "Zones", count: zoneCount ?? 0 },
    { href: "/admin/items", label: "Items", count: itemCount ?? 0 },
    { href: "/admin/species", label: "Models", count: speciesCount ?? 0 },
    ...(BREWING_ENABLED ? [{ href: "/admin/recipes", label: "Potion recipes", count: recipeCount ?? 0 }] : []),
    { href: "/admin/news", label: "Site news", count: newsCount ?? 0 },
    { href: "/admin/forums", label: "Forum categories", count: forumCategoryCount ?? 0 },
    ...(GARDEN_ENABLED ? [{ href: "/admin/garden-plants", label: "Garden plants", count: gardenPlantCount ?? 0 }] : []),
    { href: "/admin/shop-listings", label: "Shop listings", count: shopListingCount ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex flex-col gap-1 rounded-lg border border-green-200 p-4 hover:bg-green-100 dark:border-stone-800 dark:hover:bg-stone-900"
          >
            <span className="text-2xl font-semibold tracking-tight">{card.count}</span>
            <span className="text-sm text-stone-500">{card.label}</span>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Adventuring results</h2>
        <ResultsChart days={dailyResults} />
      </div>
    </div>
  );
}
