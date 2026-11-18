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

export type ObtainableSource = { label: string; live: boolean; reason: string | null };

export async function getObtainableSources(
  supabase: SupabaseClient<Database>,
  target: ObtainableTarget,
  id: string,
): Promise<ObtainableSource[]> {
  const idColumn = idColumnFor(target);

  const [{ data: poolRows }, { data: listingRows }] = await Promise.all([
    (supabase.from(poolTableFor(target)) as unknown as { select: (c: string) => { eq: (col: string, v: string) => PromiseLike<{ data: unknown }> } })
      .select("zone_id, zones(name, is_active)")
      .eq(idColumn, id),
    supabase
      .from("shop_listings")
      .select("id, starts_at, ends_at")
      .eq("listing_type", target === "item" ? "item" : "pet")
      .eq(idColumn, id as never),
  ]);

  const sources: ObtainableSource[] = [];
  const seenZones = new Set<string>();
  for (const row of (poolRows ?? []) as unknown as { zone_id: string; zones: { name: string; is_active: boolean } | null }[]) {
    // An item can appear in the same zone's pool more than once at
    // different amounts — collapse those to one source row.
    if (seenZones.has(row.zone_id)) continue;
    seenZones.add(row.zone_id);
    const zoneName = row.zones?.name ?? "(deleted zone)";
    const live = row.zones?.is_active ?? false;
    sources.push({ label: `${zoneName} (zone)`, live, reason: live ? null : "Zone is inactive" });
  }

  const now = new Date();
  for (const row of (listingRows ?? []) as unknown as { id: string; starts_at: string; ends_at: string | null }[]) {
    const status = shopListingStatus(row.starts_at, row.ends_at, now);
    let reason: string | null = null;
    if (status === "scheduled") reason = `Arrives ${new Date(row.starts_at).toLocaleDateString()}`;
    else if (status === "ended") reason = `Left the shop ${new Date(row.ends_at!).toLocaleDateString()}`;
    sources.push({ label: "Shop listing", live: status === "live", reason });
  }

  return sources;
}
