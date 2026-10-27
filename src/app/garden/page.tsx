import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nextGardenExpansionCost } from "@/lib/garden";
import { GardenGrid } from "./garden-grid";
import type { GardenPlantingWithPlant, ItemType } from "@/lib/supabase/types";
import type { InventoryOption } from "./plant-seed-modal";

type InventoryJoinRow = { quantity: number; item: { id: string; name: string; image_url: string | null; type: ItemType } | null };

export default async function GardenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Lazy status resolution before every read — same convention as
  // resolve_due_expeditions/resolve_due_brews.
  await supabase.rpc("resolve_due_garden", { p_user_id: user.id });

  const [{ data: userRow }, { data: plantingsData }, { data: inventoryData }] = await Promise.all([
    supabase.from("users").select("garden_rows, coin_balance").eq("id", user.id).single(),
    supabase
      .from("garden_plantings")
      .select(
        "id, user_id, plot_index, plant_id, fertilizer_item_id, status, planted_at, total_duration_seconds, last_watered_at, next_water_needed_at, grow_completes_at, is_pest_affected, created_at, plant:garden_plants(name, image_stage1_url, image_stage2_url, image_stage3_url, image_stage4_url)",
      )
      .eq("user_id", user.id),
    supabase
      .from("user_inventory")
      .select("quantity, item:items(id, name, image_url, type)")
      .eq("user_id", user.id)
      .gt("quantity", 0),
  ]);

  const gardenRows = userRow?.garden_rows ?? 3;
  const coinBalance = userRow?.coin_balance ?? 0;
  const expansionCost = nextGardenExpansionCost(gardenRows);

  const plantings = (plantingsData ?? []) as unknown as GardenPlantingWithPlant[];

  const inventory = (inventoryData ?? []) as unknown as InventoryJoinRow[];
  const toOption = (row: InventoryJoinRow): InventoryOption => ({
    itemId: row.item!.id,
    name: row.item!.name,
    imageUrl: row.item!.image_url,
    quantity: row.quantity,
  });
  const seedOptions = inventory.filter((row) => row.item?.type === "seed").map(toOption);
  const fertilizerOptions = inventory.filter((row) => row.item?.type === "fertilizer").map(toOption);

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Garden</h1>
        <p className="text-sm text-stone-500">
          Plant seeds, water them every 8 hours, and harvest once they&apos;re grown. Leave one thirsty too long and
          it wilts.
        </p>
      </div>

      <GardenGrid
        userId={user.id}
        gardenRows={gardenRows}
        plantings={plantings}
        seedOptions={seedOptions}
        fertilizerOptions={fertilizerOptions}
        coinBalance={coinBalance}
        expansionCost={expansionCost}
      />
        </div>
      </div>
    </main>
  );
}
