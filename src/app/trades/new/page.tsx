import { notFound, redirect } from "next/navigation";
import { TRADING_ENABLED } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { TradeBuilderForm } from "./trade-builder-form";
import type { ItemWithQuantity, PetWithSpecies } from "@/lib/supabase/types";

export default async function NewTradePage(props: PageProps<"/trades/new">) {
  if (!TRADING_ENABLED) {
    notFound();
  }

  const searchParams = await props.searchParams;
  const toParam = Array.isArray(searchParams.to) ? searchParams.to[0] : searchParams.to;
  const petIdParam = Array.isArray(searchParams.petId) ? searchParams.petId[0] : searchParams.petId;
  const itemIdParam = Array.isArray(searchParams.itemId)
    ? searchParams.itemId[0]
    : searchParams.itemId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: petsData }, { data: inventoryData }, { data: profile }] = await Promise.all([
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
    supabase.from("users").select("coin_balance, gem_balance").eq("id", user.id).single(),
  ]);

  const pets = (petsData ?? []) as unknown as PetWithSpecies[];
  const inventory = (inventoryData ?? []) as unknown as ItemWithQuantity[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Propose a trade</h1>
        <p className="text-sm text-stone-500">
          Pick what you&apos;re offering from your own den and inventory. The other player
          builds their side when they respond.
        </p>
      </div>

      <TradeBuilderForm
        userId={user.id}
        initialRecipientName={toParam ?? ""}
        initialPetId={petIdParam}
        initialItemId={itemIdParam}
        pets={pets}
        inventory={inventory}
        coinBalance={profile?.coin_balance ?? 0}
        gemBalance={profile?.gem_balance ?? 0}
      />
    </main>
  );
}
