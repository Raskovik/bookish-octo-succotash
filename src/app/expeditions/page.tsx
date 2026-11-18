import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpeditionsApp } from "./expeditions-app";
import type {
  ActiveExpeditionSummary,
  ExplorableZone,
  OwnedPotion,
  PetFolderRow,
  PetWithStats,
} from "@/lib/supabase/types";

// Row shapes of the zone_pet_pool -> species, zone_loot_table -> items,
// and user_inventory -> items (potions only) joins below. Hand-cast, like
// the other joined selects in this project — see the comment on
// PetWithSpecies in lib/supabase/types.ts.
type ZonePetPoolJoinRow = {
  zone_id: string;
  species: { id: string; name: string; image_url: string | null } | null;
};
type ZoneLootTableJoinRow = {
  zone_id: string;
  items: { id: string; name: string; image_url: string | null; rarity: string } | null;
};
type OwnedPotionJoinRow = {
  item_id: string;
  quantity: number;
  items: { name: string; image_url: string | null } | null;
};

export default async function ExpeditionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Same lazy-resolution pattern as the profile page: settle anything
  // whose timer has already elapsed before reading current state.
  const { error: resolveError } = await supabase.rpc("resolve_due_expeditions", { p_user_id: user.id });
  if (resolveError) {
    // Not fatal to the page load — the player just sees their
    // expedition(s) still showing as in-progress/past-due, and
    // useTripCountdown (expeditions-app.tsx) keeps retrying every few
    // seconds. Logged so a real, persistent failure here is actually
    // visible somewhere instead of silently doing nothing every load.
    console.error("resolve_due_expeditions failed", resolveError);
  }

  const [
    { data: zonesData },
    { data: petPoolData },
    { data: lootTableData },
    { data: petsData },
    { data: foldersData },
    { data: activeData },
    { data: potionsData },
    { count: expeditionCount },
    { data: configData },
  ] = await Promise.all([
    supabase
      .from("zones")
      .select("id, name, tier, description, image_url, map_x, map_y, map_width, map_height")
      .eq("is_active", true)
      .eq("is_tutorial", false)
      .order("tier", { ascending: true }),
    supabase.from("zone_pet_pool").select("zone_id, species(id, name, image_url)"),
    supabase.from("zone_loot_table").select("zone_id, items(id, name, image_url, rarity)"),
    supabase
      .from("pets")
      .select(
        "id, color_variant, folder_id, custom_name, is_for_trade, level, roll_strength, roll_speed, roll_defence, last_fed_at, created_at, species(name, image_url)",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("pet_folders")
      .select("id, owner_id, name, color, bio, sort_order, created_at")
      .eq("owner_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("expeditions")
      .select("id, pet_id, zone_id, started_at, resolves_at, status")
      .eq("user_id", user.id)
      .in("status", ["in_progress", "awaiting_claim"]),
    supabase
      .from("user_inventory")
      .select("item_id, quantity, items!inner(name, image_url, type)")
      .eq("user_id", user.id)
      .eq("items.type", "potion")
      .gt("quantity", 0),
    // Cheap existence check, not a count — just enough to know whether
    // the player's NEXT trip is the one start_expedition (0071) always
    // caps at 10 minutes, so the duration estimate below can reflect
    // that instead of the normal Speed-driven 60-180 minute range.
    supabase.from("expeditions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    // Live copy of the formula constants start_expedition actually uses
    // (0080_guaranteed_pet_and_tunable_odds.sql), so the pre-send
    // duration estimate below (estimatedTripRange, expeditions-app.tsx)
    // stays accurate after an admin tunes /admin/game-config — it used
    // to hardcode its own copy of these, which drifted out of sync the
    // moment any of them changed.
    supabase
      .from("game_config")
      .select("key, value")
      .in("key", [
        "trip_duration_min_minutes",
        "trip_duration_max_minutes",
        "trip_duration_speed_skew",
        "stat_saturation_k",
        "first_trip_duration_minutes",
      ]),
  ]);

  // Pets and items are drawn from the same weighted roll server-side (see
  // pick_weighted_zone_reward), so the preview merges both pools into one
  // kind-tagged list rather than showing them separately.
  const poolByZone = new Map<string, ExplorableZone["pool"]>();
  for (const row of (petPoolData ?? []) as unknown as ZonePetPoolJoinRow[]) {
    if (!row.species) continue;
    const list = poolByZone.get(row.zone_id) ?? [];
    list.push({
      kind: "pet",
      id: row.species.id,
      name: row.species.name,
      image_url: row.species.image_url,
      rarity: null,
    });
    poolByZone.set(row.zone_id, list);
  }
  for (const row of (lootTableData ?? []) as unknown as ZoneLootTableJoinRow[]) {
    if (!row.items) continue;
    const list = poolByZone.get(row.zone_id) ?? [];
    list.push({
      kind: "item",
      id: row.items.id,
      name: row.items.name,
      image_url: row.items.image_url,
      rarity: row.items.rarity as ExplorableZone["pool"][number]["rarity"],
    });
    poolByZone.set(row.zone_id, list);
  }

  const zones: ExplorableZone[] = (zonesData ?? []).map((zone) => ({
    ...zone,
    pool: poolByZone.get(zone.id) ?? [],
  }));

  const pets = (petsData ?? []) as unknown as PetWithStats[];
  const folders = (foldersData ?? []) as PetFolderRow[];
  const activeExpeditions = (activeData ?? []) as ActiveExpeditionSummary[];
  const ownedPotions: OwnedPotion[] = ((potionsData ?? []) as unknown as OwnedPotionJoinRow[])
    .filter((row) => row.items)
    .map((row) => ({
      itemId: row.item_id,
      name: row.items!.name,
      image_url: row.items!.image_url,
      quantity: row.quantity,
    }));

  // Fallbacks match game_config's own seeded defaults (0080) — only hit
  // if a row is somehow missing, never the normal case.
  const configByKey = new Map((configData ?? []).map((c) => [c.key, c.value]));
  const tripDurationConfig = {
    minMinutes: configByKey.get("trip_duration_min_minutes") ?? 60,
    maxMinutes: configByKey.get("trip_duration_max_minutes") ?? 180,
    speedSkew: configByKey.get("trip_duration_speed_skew") ?? 2,
    saturationK: configByKey.get("stat_saturation_k") ?? 30,
    firstTripMinutes: configByKey.get("first_trip_duration_minutes") ?? 10,
  };

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel">
          <ExpeditionsApp
            userId={user.id}
            zones={zones}
            pets={pets}
            folders={folders}
            activeExpeditions={activeExpeditions}
            ownedPotions={ownedPotions}
            isFirstTrip={(expeditionCount ?? 0) === 0}
            tripDurationConfig={tripDurationConfig}
          />
        </div>
      </div>
    </main>
  );
}
