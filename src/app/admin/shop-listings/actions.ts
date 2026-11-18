"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { ItemType, ShopListingType, ShopSection } from "@/lib/supabase/types";

const SHOP_SECTIONS: ShopSection[] = ["pets", "food", "specials"];
const LISTING_TYPES: ShopListingType[] = ["item", "pet"];

export type ShopListingFormState = { error: string } | null;

// <input type="date"> gives/wants "YYYY-MM-DD" — stored as that date at
// midnight UTC. Good enough for a shop arrival/departure date, which is
// never shown or compared at sub-day precision.
function parseDateInput(raw: string): Date | null {
  if (raw.length === 0) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function readShopListingFields(
  formData: FormData,
  getItemType: (itemId: string) => Promise<ItemType | null>,
) {
  const section = String(formData.get("section") ?? "");
  const listingType = String(formData.get("listing_type") ?? "");
  const itemId = String(formData.get("item_id") ?? "").trim();
  const speciesId = String(formData.get("species_id") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const priceCoinsRaw = String(formData.get("price_coins") ?? "").trim();
  const priceGemsRaw = String(formData.get("price_gems") ?? "").trim();
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const endsAtRaw = String(formData.get("ends_at") ?? "").trim();

  if (!SHOP_SECTIONS.includes(section as ShopSection)) {
    return { ok: false as const, error: "Invalid shop section." };
  }
  if (!LISTING_TYPES.includes(listingType as ShopListingType)) {
    return { ok: false as const, error: "Invalid listing type." };
  }
  if (listingType === "item" && itemId.length === 0) {
    return { ok: false as const, error: "Pick an item to sell." };
  }
  if (listingType === "pet" && speciesId.length === 0) {
    return { ok: false as const, error: "Pick a species to sell." };
  }

  // Section/target consistency — pet models only go in Pets, and Food
  // is reserved for items that are actually food.
  if (listingType === "pet" && section !== "pets") {
    return { ok: false as const, error: "Pet models go in the Pets section." };
  }
  if (listingType === "item" && section === "pets") {
    return { ok: false as const, error: "Pets is only for pet models. Use Food or Special for items." };
  }
  if (listingType === "item" && section === "food") {
    const itemType = await getItemType(itemId);
    if (itemType !== "ingredient") {
      return { ok: false as const, error: "Food is only for food items. Use Special for other items." };
    }
  }

  let priceCoins: number | null = null;
  if (priceCoinsRaw.length > 0) {
    priceCoins = Number(priceCoinsRaw);
    if (!Number.isInteger(priceCoins) || priceCoins < 0) {
      return { ok: false as const, error: "Coin price must be a non-negative whole number, or blank." };
    }
  }

  let priceGems: number | null = null;
  if (priceGemsRaw.length > 0) {
    priceGems = Number(priceGemsRaw);
    if (!Number.isInteger(priceGems) || priceGems < 0) {
      return { ok: false as const, error: "Gem price must be a non-negative whole number, or blank." };
    }
  }

  if (!(priceCoins && priceCoins > 0) && !(priceGems && priceGems > 0)) {
    return { ok: false as const, error: "Set a coin price, a gem price, or both — at least one above zero." };
  }

  const startsAt = parseDateInput(startsAtRaw) ?? new Date();
  const endsAt = parseDateInput(endsAtRaw);
  if (endsAtRaw.length > 0 && !endsAt) {
    return { ok: false as const, error: "Invalid leave date." };
  }
  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { ok: false as const, error: "The leave date can't be before the arrival date." };
  }

  return {
    ok: true as const,
    fields: {
      section: section as ShopSection,
      listing_type: listingType as ShopListingType,
      item_id: listingType === "item" ? itemId : null,
      species_id: listingType === "pet" ? speciesId : null,
      description: descriptionRaw.length > 0 ? descriptionRaw : null,
      price_coins: priceCoins,
      price_gems: priceGems,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
    },
  };
}

export async function createShopListing(
  _prevState: ShopListingFormState,
  formData: FormData,
): Promise<ShopListingFormState> {
  const { supabase } = await requireAdmin();

  const parsed = await readShopListingFields(formData, async (itemId) => {
    const { data } = await supabase.from("items").select("type").eq("id", itemId).maybeSingle();
    return data?.type ?? null;
  });
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("shop_listings").insert(parsed.fields);
  if (error) {
    return { error: `Could not create listing: ${error.message}` };
  }

  revalidatePath("/admin/shop-listings");
  revalidatePath("/shop");
  redirect("/admin/shop-listings");
}

export async function updateShopListing(
  _prevState: ShopListingFormState,
  formData: FormData,
): Promise<ShopListingFormState> {
  const { supabase } = await requireAdmin();

  const listingId = String(formData.get("listing_id") ?? "");
  if (listingId.length === 0) return { error: "Missing listing." };

  const parsed = await readShopListingFields(formData, async (itemId) => {
    const { data } = await supabase.from("items").select("type").eq("id", itemId).maybeSingle();
    return data?.type ?? null;
  });
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("shop_listings").update(parsed.fields).eq("id", listingId);
  if (error) {
    return { error: `Could not save listing: ${error.message}` };
  }

  revalidatePath("/admin/shop-listings");
  revalidatePath("/shop");
  redirect("/admin/shop-listings");
}

export async function deleteShopListing(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();

  const listingId = String(formData.get("listing_id") ?? "");
  if (listingId.length === 0) return;

  await supabase.from("shop_listings").delete().eq("id", listingId);

  revalidatePath("/admin/shop-listings");
  revalidatePath("/shop");
}
