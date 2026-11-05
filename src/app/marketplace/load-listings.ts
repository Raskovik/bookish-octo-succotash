import type { createClient } from "@/lib/supabase/server";
import type { MarketplaceListing } from "@/lib/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Shared by /marketplace/listings (and anywhere else that already has a set
// of listing ids in hand) — resolves seller/buyer display names via the
// public user_profiles view (same reason as load-trades.ts: `users`
// only lets a player see their own row) and, for item listings, joins
// the catalog `items` table for display. /marketplace itself (the
// browse page) queries marketplace_listings directly instead, since it
// needs to filter/paginate at the database level rather than load a
// known set of ids.
export async function loadListings(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<MarketplaceListing[]> {
  if (listingIds.length === 0) {
    return [];
  }

  const { data: listingsData } = await supabase
    .from("marketplace_listings")
    .select(
      "id, listing_type, status, price_coins, price_gems, seller_id, buyer_id, pet_id, pet_species_name, pet_species_image_url, pet_rarity, pet_custom_name, item_id, item_quantity, created_at, expires_at, sold_at",
    )
    .in("id", listingIds)
    .order("created_at", { ascending: false });

  const listings = listingsData ?? [];
  if (listings.length === 0) {
    return [];
  }

  const participantIds = [
    ...new Set(
      listings.flatMap((l) => [l.seller_id, l.buyer_id]).filter((id): id is string => id !== null),
    ),
  ];
  const itemIds = [...new Set(listings.filter((l) => l.item_id).map((l) => l.item_id as string))];

  const [{ data: profilesData }, { data: itemsData }] = await Promise.all([
    supabase.from("user_profiles").select("id, display_id, display_name").in("id", participantIds),
    itemIds.length > 0
      ? supabase.from("items").select("id, name, image_url, rarity, type").in("id", itemIds)
      : Promise.resolve({ data: [] as { id: string; name: string; image_url: string | null; rarity: string; type: string }[] }),
  ]);

  const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));
  const displayIdById = new Map((profilesData ?? []).map((p) => [p.id, p.display_id]));
  const itemById = new Map((itemsData ?? []).map((i) => [i.id, i]));

  return listings.map((l) => {
    const item = l.item_id ? itemById.get(l.item_id) : undefined;
    return {
      id: l.id,
      listing_type: l.listing_type,
      status: l.status,
      price_coins: l.price_coins,
      price_gems: l.price_gems,
      pet_id: l.pet_id,
      pet_species_name: l.pet_species_name,
      pet_species_image_url: l.pet_species_image_url,
      pet_rarity: l.pet_rarity,
      pet_custom_name: l.pet_custom_name,
      item_quantity: l.item_quantity,
      created_at: l.created_at,
      expires_at: l.expires_at,
      sold_at: l.sold_at,
      sellerId: l.seller_id,
      sellerDisplayId: displayIdById.get(l.seller_id) ?? 0,
      sellerName: nameById.get(l.seller_id) ?? "Unknown player",
      buyerId: l.buyer_id,
      buyerDisplayId: l.buyer_id ? (displayIdById.get(l.buyer_id) ?? 0) : null,
      buyerName: l.buyer_id ? (nameById.get(l.buyer_id) ?? "Unknown player") : null,
      itemId: l.item_id,
      itemName: item?.name ?? null,
      itemImageUrl: item?.image_url ?? null,
      itemRarity: (item?.rarity as MarketplaceListing["itemRarity"]) ?? null,
      itemType: (item?.type as MarketplaceListing["itemType"]) ?? null,
    };
  });
}
