import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellForm } from "./sell-form";
import { statTier } from "@/lib/pet-combat";
import type { ItemWithQuantity, PetWithStats } from "@/lib/supabase/types";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SellPage(props: PageProps<"/marketplace/sell">) {
  const searchParams = await props.searchParams;
  const preselectItemId = first(searchParams.item) ?? null;
  const preselectPetId = first(searchParams.pet) ?? null;
  const relistListingId = first(searchParams.relist) ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: petsData }, { data: inventoryData }, { data: listedPetIds }, { data: outPetIds }] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, color_variant, folder_id, custom_name, is_for_trade, level, roll_strength, roll_speed, roll_defence, last_fed_at, created_at, species(name, image_url)",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_inventory")
      .select("quantity, is_for_trade, item:items(id, name, image_url, rarity, type)")
      .eq("user_id", user.id)
      .gt("quantity", 0)
      .order("item_id", { ascending: true }),
    supabase.from("marketplace_listings").select("pet_id").eq("status", "active").eq("listing_type", "pet"),
    supabase.from("expeditions").select("pet_id").in("status", ["in_progress", "awaiting_claim"]),
  ]);

  const pets = (petsData ?? []) as unknown as PetWithStats[];
  const inventory = (inventoryData ?? []) as unknown as ItemWithQuantity[];
  const listedSet = new Set((listedPetIds ?? []).map((r) => r.pet_id));
  const outSet = new Set((outPetIds ?? []).map((r) => r.pet_id));

  const petOptions = pets.map((pet) => {
    const allTen = pet.roll_strength >= 10 && pet.roll_speed >= 10 && pet.roll_defence >= 10;
    const unavailableReason = outSet.has(pet.id) ? "Away" : listedSet.has(pet.id) ? "For sale" : null;
    return {
      id: pet.id,
      name: pet.custom_name ?? pet.species?.name ?? "Pet",
      speciesName: pet.species?.name ?? "",
      imageUrl: pet.species?.image_url ?? null,
      strength: pet.roll_strength,
      speed: pet.roll_speed,
      defence: pet.roll_defence,
      strTier: statTier(pet.roll_strength, allTen),
      spdTier: statTier(pet.roll_speed, allTen),
      defTier: statTier(pet.roll_defence, allTen),
      unavailableReason,
    };
  });

  const itemOptions = inventory
    .filter((entry) => entry.item)
    .map((entry) => ({
      id: entry.item!.id,
      name: entry.item!.name,
      imageUrl: entry.item!.image_url,
      category: entry.item!.type,
      quantity: entry.quantity,
    }));

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel">
          <div className="mk-top">
            <div>
              <h1 className="mk-h1">Sell something</h1>
              <p className="mk-sub">Choose the price, and whether buyers pay in coins or gems.</p>
            </div>
            <div className="mk-act">
              <Link className="btn btn-sm btn-cream" href="/marketplace">
                Back to Marketplace
              </Link>
              <Link className="btn btn-sm btn-cream" href="/marketplace/listings">
                My listings
              </Link>
            </div>
          </div>

          <SellForm
            userId={user.id}
            petOptions={petOptions}
            itemOptions={itemOptions}
            preselectItemId={preselectItemId}
            preselectPetId={preselectPetId}
            relistListingId={relistListingId}
          />
        </div>
      </div>
    </main>
  );
}
