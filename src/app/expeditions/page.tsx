import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { compositeMissingPetImages } from "@/lib/pet-compositor";
import { ExpeditionMap } from "@/components/expedition-map";
import type {
  ActiveExpeditionSummary,
  ExplorableZone,
  OwnedPotion,
  PetWithSpecies,
} from "@/lib/supabase/types";

// Row shape of the zone_loot_table -> items and user_inventory -> items
// (potions only) joins below. Hand-cast, like the other joined selects in
// this project — see the comment on PetWithSpecies in
// lib/supabase/types.ts. Zones only ever grant items now (see
// 0038_trait_breeding_schema.sql) — zone_pet_pool is gone.
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
  // The tutorial branch of resolve_due_expeditions above can grant a
  // second trait-based starter pet with no composited image yet.
  await compositeMissingPetImages(supabase, user.id);

  const [
    { data: zonesData },
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
    supabase.from("zone_loot_table").select("zone_id, items(id, name, image_url, rarity)"),
    supabase
      .from("pets")
      .select("id, rarity, color_variant, created_at, composited_image_url, gender, species(name, image_url), breed:breeds(name)")
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

  // Item-only now — zones no longer grant pets (pick_weighted_zone_reward
  // draws from zone_loot_table alone, see 0038_trait_breeding_schema.sql).
  const poolByZone = new Map<string, ExplorableZone["pool"]>();
  for (const row of (lootTableData ?? []) as unknown as ZoneLootTableJoinRow[]) {
    if (!row.items) continue;
    const list = poolByZone.get(row.zone_id) ?? [];
    list.push({
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
