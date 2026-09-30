import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellForm } from "./sell-form";
import type { ItemWithQuantity, PetWithSpecies } from "@/lib/supabase/types";

export default async function SellPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: petsData }, { data: inventoryData }] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, rarity, color_variant, folder_id, custom_name, is_for_trade, created_at, species(name, image_url)",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_inventory")
      .select("quantity, is_for_trade, item:items(id, name, image_url, rarity, type)")
      .eq("user_id", user.id)
      .gt("quantity", 0)
      .order("item_id", { ascending: true }),
  ]);

  const pets = (petsData ?? []) as unknown as PetWithSpecies[];
  const inventory = (inventoryData ?? []) as unknown as ItemWithQuantity[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sell something</h1>
        <p className="text-sm text-stone-500">
          List a pet or a stack of items for coins. A buyer pays your price and it&apos;s
          instantly theirs — no bidding.
        </p>
      </div>

      <SellForm userId={user.id} pets={pets} inventory={inventory} />
    </main>
  );
}
