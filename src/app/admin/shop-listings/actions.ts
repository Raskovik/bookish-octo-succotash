"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { ShopListingType, ShopSection } from "@/lib/supabase/types";

const SHOP_SECTIONS: ShopSection[] = ["pets", "food", "den", "specials"];
const LISTING_TYPES: ShopListingType[] = ["item", "pet"];

export type ShopListingFormState = { error: string } | null;

function readShopListingFields(formData: FormData) {
  const section = String(formData.get("section") ?? "");
  const listingType = String(formData.get("listing_type") ?? "");
  const itemId = String(formData.get("item_id") ?? "").trim();
  const speciesId = String(formData.get("species_id") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const priceCoinsRaw = String(formData.get("price_coins") ?? "").trim();
  const priceGemsRaw = String(formData.get("price_gems") ?? "").trim();
  const endsAtRaw = String(formData.get("ends_at") ?? "").trim();
  const isNew = formData.get("is_new") === "on";
  const isActive = formData.get("is_active") === "on";

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

  if (priceCoins === null && priceGems === null) {
    return { ok: false as const, error: "Set a coin price, a gem price, or both." };
  }

  let endsAt: string | null = null;
  if (endsAtRaw.length > 0) {
    const parsed = new Date(endsAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false as const, error: "Invalid expiry date/time." };
    }
    endsAt = parsed.toISOString();
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
      is_new: isNew,
      ends_at: endsAt,
      is_active: isActive,
    },
  };
}

export async function createShopListing(
  _prevState: ShopListingFormState,
  formData: FormData,
): Promise<ShopListingFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readShopListingFields(formData);
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

  const parsed = readShopListingFields(formData);
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
