import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { shopListingStatus } from "@/lib/shop-status";

/**
 * "Obtainable" is never stored — it's computed here from whether an item
 * or species has at least one LIVE source: an active zone's pool entry,
 * or a shop listing that's currently live (per shopListingStatus()). Used
 * by both the Items and Models admin pages (see 0082_admin_redesign_schema
 * and the furgarden-admin-panel redesign package).
 */
export type ObtainableTarget = "item" | "species";

type PoolRow = { item_id?: string | null; species_id?: string | null; zones: { is_active: boolean } | null };
type ListingRow = { item_id?: string | null; species_id?: string | null; starts_at: string; ends_at: string | null };

function poolTableFor(target: ObtainableTarget) {
  return target === "item" ? "zone_loot_table" : "zone_pet_pool";
}

function idColumnFor(target: ObtainableTarget) {
  return target === "item" ? "item_id" : "species_id";
}

export async function getObtainableIdSet(
  supabase: SupabaseClient<Database>,
  target: ObtainableTarget,
): Promise<Set<string>> {
  const idColumn = idColumnFor(target);

  const [{ data: poolRows }, { data: listingRows }] = await Promise.all([
    supabase
      .from(poolTableFor(target))
      .select(`${idColumn}, zones!inner(is_active)`)
      .eq("zones.is_active", true),
    supabase
      .from("shop_listings")
      .select(`${idColumn}, starts_at, ends_at`)
      .eq("listing_type", target === "item" ? "item" : "pet"),
  ]);

  const ids = new Set<string>();
  for (const row of (poolRows ?? []) as unknown as PoolRow[]) {
    const id = target === "item" ? row.item_id : row.species_id;
    if (id) ids.add(id);
  }

  const now = new Date();
  for (const row of (listingRows ?? []) as unknown as ListingRow[]) {
    const id = target === "item" ? row.item_id : row.species_id;
    if (!id) continue;
    if (shopListingStatus(row.starts_at, row.ends_at, now) === "live") ids.add(id);
  }

  return ids;
}

// One row of the "Where it can be obtained" table on the Items/Models
// edit pages — a single zone pool entry or shop listing this item/species
// appears in, with enough detail to render without a second lookup.
export type ObtainableSource = {
  where: string;
  details: string;
  live: boolean;
  reason: string | null;
  editHref: string;
  editLabel: string;
};

function formatPrice(coins: number | null, gems: number | null): string {
  const parts = [coins ? `${coins} coins` : null, gems ? `${gems} gems` : null].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Free";
}

export async function getObtainableSources(
  supabase: SupabaseClient<Database>,
  target: ObtainableTarget,
  id: string,
): Promise<ObtainableSource[]> {
  const idColumn = idColumnFor(target);
  const poolTable = poolTableFor(target);

  // Both tables' queries vary their column name (and, for items, an extra
  // "amount" column) by `target`, which the generated Supabase types can't
  // express generically — cast to `any` for these calls rather than
  // duplicating this function per target.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [{ data: poolRows }, { data: listingRows }] = await Promise.all([
    (supabase.from(poolTable) as any)
      .select(target === "item" ? "zone_id, amount, drop_weight, zones(name, is_active)" : "zone_id, drop_weight, zones(name, is_active)")
      .eq(idColumn, id),
    (supabase.from("shop_listings") as any)
      .select("id, section, starts_at, ends_at, price_coins, price_gems")
      .eq("listing_type", target === "item" ? "item" : "pet")
      .eq(idColumn, id),
  ]);

  type PoolEntry = {
    zone_id: string;
    amount?: number;
    drop_weight: number;
    zones: { name: string; is_active: boolean } | null;
  };
  const poolEntries = (poolRows ?? []) as unknown as PoolEntry[];

  // Each entry's "chance" is its drop_weight against the *whole* zone
  // pool's weight — the same denominator the zone edit page's own pool
  // tables use — so a second, unfiltered query gets every entry in each
  // zone this item/species' entries touch.
  const zoneIds = Array.from(new Set(poolEntries.map((p) => p.zone_id)));
  const zoneTotalWeight = new Map<string, number>();
  if (zoneIds.length > 0) {
    const { data: allPoolRows } = await (supabase.from(poolTable) as any).select("zone_id, drop_weight").in("zone_id", zoneIds);
    for (const row of (allPoolRows ?? []) as { zone_id: string; drop_weight: number }[]) {
      zoneTotalWeight.set(row.zone_id, (zoneTotalWeight.get(row.zone_id) ?? 0) + row.drop_weight);
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const sources: ObtainableSource[] = [];
  for (const entry of poolEntries) {
    const zoneName = entry.zones?.name ?? "(deleted zone)";
    const live = entry.zones?.is_active ?? false;
    const totalWeight = zoneTotalWeight.get(entry.zone_id) ?? 0;
    const chance = totalWeight > 0 ? Math.round((entry.drop_weight / totalWeight) * 100) : 0;
    sources.push({
      where: `Zone: ${zoneName}`,
      details: target === "item" ? `${entry.amount} per find, ${chance}% chance` : `${chance}% chance`,
      live,
      reason: live ? null : "Zone is inactive",
      editHref: `/admin/zones/${entry.zone_id}${target === "item" ? "#item-pool" : "#pet-pool"}`,
      editLabel: "Edit zone",
    });
  }

  const now = new Date();
  for (const row of (listingRows ?? []) as unknown as {
    id: string;
    section: string;
    starts_at: string;
    ends_at: string | null;
    price_coins: number | null;
    price_gems: number | null;
  }[]) {
    const status = shopListingStatus(row.starts_at, row.ends_at, now);
    let reason: string | null = null;
    if (status === "scheduled") reason = `Arrives ${new Date(row.starts_at).toLocaleDateString()}`;
    else if (status === "ended") reason = `Left the shop ${new Date(row.ends_at!).toLocaleDateString()}`;
    sources.push({
      where: `Shop: ${row.section.charAt(0).toUpperCase()}${row.section.slice(1)}`,
      details: formatPrice(row.price_coins, row.price_gems),
      live: status === "live",
      reason,
      editHref: `/admin/shop-listings/${row.id}`,
      editLabel: "Edit listing",
    });
  }

  return sources;
}
