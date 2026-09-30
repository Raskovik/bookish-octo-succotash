import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpeditionMap } from "@/components/expedition-map";
import type {
  ActiveExpeditionSummary,
  ExplorableZone,
  OwnedPotion,
  PetWithSpecies,
} from "@/lib/supabase/types";

// Row shapes of the zone_pet_pool -> species, zone_loot_table -> items,
// and user_inventory -> items (potions only) joins below. Hand-cast, like
// the other joined selects in this project — see the comment on
// PetWithSpecies in lib/supabase/types.ts.
type ZonePetPoolJoinRow = {
  zone_id: string;
  species: { id: string; name: string; image_url: string | null; rarity: string } | null;
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
  await supabase.rpc("resolve_due_expeditions", { p_user_id: user.id });

  const [
    { data: zonesData },
    { data: petPoolData },
    { data: lootTableData },
    { data: petsData },
    { data: activeData },
    { data: potionsData },
  ] = await Promise.all([
    supabase
      .from("zones")
      .select("id, name, tier, description, image_url, map_x, map_y, map_width, map_height")
      .eq("is_active", true)
      .eq("is_tutorial", false)
      .order("tier", { ascending: true }),
    supabase.from("zone_pet_pool").select("zone_id, species(id, name, image_url, rarity)"),
    supabase.from("zone_loot_table").select("zone_id, items(id, name, image_url, rarity)"),
    supabase
      .from("pets")
      .select("id, rarity, color_variant, created_at, species(name, image_url)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("expeditions")
      .select("id, pet_id, zone_id, resolves_at, status")
      .eq("user_id", user.id)
      .in("status", ["in_progress", "awaiting_claim"]),
    supabase
      .from("user_inventory")
      .select("item_id, quantity, items!inner(name, image_url, type)")
      .eq("user_id", user.id)
      .eq("items.type", "potion")
      .gt("quantity", 0),
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
      rarity: row.species.rarity as ExplorableZone["pool"][number]["rarity"],
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

  const pets = (petsData ?? []) as unknown as PetWithSpecies[];
  const activeExpeditions = (activeData ?? []) as ActiveExpeditionSummary[];
  const ownedPotions: OwnedPotion[] = ((potionsData ?? []) as unknown as OwnedPotionJoinRow[])
    .filter((row) => row.items)
    .map((row) => ({
      itemId: row.item_id,
      name: row.items!.name,
      image_url: row.items!.image_url,
      quantity: row.quantity,
    }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expeditions</h1>
        <p className="text-sm text-stone-500">
          Pick an area on the map to see what it offers and send a pet to explore it.
        </p>
      </div>
      <ExpeditionMap
        zones={zones}
        pets={pets}
        activeExpeditions={activeExpeditions}
        ownedPotions={ownedPotions}
      />
    </main>
  );
}
