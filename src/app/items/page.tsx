import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ItemsApp, type UIItem } from "./items-app";
import type { ItemWithQuantity } from "@/lib/supabase/types";

// Ported from furgarden-design's pages/items.html + js/items.js (see
// README, "Items page") — category tabs, search, sort and the detail
// panel all run client-side against this one fetch, same shape as
// pets-app.tsx. "Food points" is real here (0054_food_points.sql):
// convert_items_to_food() is what the design's own "create food
// points" action was always meant to call.
export default async function ItemsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: userRow }, { data: inventoryData }] = await Promise.all([
    supabase.from("users").select("food_points").eq("id", user.id).single(),
    supabase
      .from("user_inventory")
      .select("quantity, is_for_trade, item:items(id, name, image_url, rarity, type, description, food_value)")
      .eq("user_id", user.id)
      .gt("quantity", 0)
      .order("item_id", { ascending: true }),
  ]);

  const entries = (inventoryData ?? []) as unknown as ItemWithQuantity[];

  const items: UIItem[] = entries
    .filter((entry) => entry.item !== null)
    .map((entry) => ({
      id: entry.item!.id,
      name: entry.item!.name,
      type: entry.item!.type,
      description: entry.item!.description,
      imageUrl: entry.item!.image_url,
      quantity: entry.quantity,
      foodValue: entry.item!.food_value,
    }));

  return (
    <main id="main">
      <div className="sheet">
        <ItemsApp userId={user.id} initialItems={items} initialFoodPoints={userRow?.food_points ?? 0} />
      </div>
    </main>
  );
}
