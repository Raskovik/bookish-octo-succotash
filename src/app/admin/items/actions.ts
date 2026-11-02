"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { uploadGameImage } from "@/lib/game-image-upload";
import type { FertilizerEffectType, ItemRarity, ItemType } from "@/lib/supabase/types";

const ITEM_TYPES: ItemType[] = ["ingredient", "cosmetic", "potion", "seed", "fertilizer"];
const ITEM_RARITIES: ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export type ItemFormState = { error: string } | null;

function readItemFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const rarity = String(formData.get("rarity") ?? "");
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const sellValueRaw = String(formData.get("sell_value") ?? "");
  const shopPriceRaw = String(formData.get("shop_price") ?? "").trim();
  const foodValueRaw = String(formData.get("food_value") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };
  if (!ITEM_TYPES.includes(type as ItemType))
    return { ok: false as const, error: "Invalid item type." };
  if (!ITEM_RARITIES.includes(rarity as ItemRarity))
    return { ok: false as const, error: "Invalid rarity." };

  const sellValue = Number(sellValueRaw);
  if (!Number.isInteger(sellValue) || sellValue < 0) {
    return { ok: false as const, error: "Sell value must be a non-negative whole number." };
  }

  let shopPrice: number | null = null;
  if (shopPriceRaw.length > 0) {
    shopPrice = Number(shopPriceRaw);
    if (!Number.isInteger(shopPrice) || shopPrice < 0) {
      return { ok: false as const, error: "Shop price must be a non-negative whole number, or blank." };
    }
  }

  let foodValue: number | null = null;
  if (foodValueRaw.length > 0) {
    foodValue = Number(foodValueRaw);
    if (!Number.isInteger(foodValue) || foodValue < 0) {
      return { ok: false as const, error: "Food value must be a non-negative whole number, or blank." };
    }
  }

  return {
    ok: true as const,
    fields: {
      name,
      type: type as ItemType,
      rarity: rarity as ItemRarity,
      image_url: imageUrlRaw.length > 0 ? imageUrlRaw : null,
      description: descriptionRaw.length > 0 ? descriptionRaw : null,
      sell_value: sellValue,
      shop_price: shopPrice,
      food_value: foodValue,
      is_active: isActive,
    },
  };
}

export async function createItem(
  _prevState: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readItemFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { data, error } = await supabase
    .from("items")
    .insert(parsed.fields)
    .select("id")
    .single();
  if (error || !data) {
    return { error: `Could not create item: ${error?.message ?? "unknown error"}` };
  }

  // The uploaded file is keyed by the item's id, so the item has to exist
  // first — upload after insert, then patch image_url in a second write.
  const imageFile = formData.get("image_file");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploadedUrl = await uploadGameImage(supabase, "items", data.id, imageFile);
      if (uploadedUrl) {
        await supabase.from("items").update({ image_url: uploadedUrl }).eq("id", data.id);
      }
    } catch (uploadError) {
      return {
        error: `Item created, but the image upload failed: ${
          uploadError instanceof Error ? uploadError.message : "unknown error"
        }`,
      };
    }
  }

  revalidatePath("/admin/items");
  redirect("/admin/items");
}

export async function updateItem(
  _prevState: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const { supabase } = await requireAdmin();

  const itemId = String(formData.get("item_id") ?? "");
  if (itemId.length === 0) return { error: "Missing item id." };

  const parsed = readItemFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const imageFile = formData.get("image_file");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploadedUrl = await uploadGameImage(supabase, "items", itemId, imageFile);
      if (uploadedUrl) {
        parsed.fields.image_url = uploadedUrl;
      }
    } catch (uploadError) {
      return {
        error: uploadError instanceof Error ? uploadError.message : "Image upload failed.",
      };
    }
  }

  const { error } = await supabase.from("items").update(parsed.fields).eq("id", itemId);
  if (error) {
    return { error: `Could not save item: ${error.message}` };
  }

  revalidatePath("/admin/items");
  redirect("/admin/items");
}

// ── Seed pools (a 'seed' item's garden_plants pool) ─────────────────────
// Same upsert/delete shape as the zone pet pool editor (admin/zones/
// actions.ts) — a "plants one specific plant" seed is just a pool with a
// single row (see 0035_gardening.sql's comment on seed_plants).
export async function addSeedPoolEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const seedItemId = String(formData.get("seed_item_id") ?? "");
  const plantId = String(formData.get("plant_id") ?? "");
  const dropWeight = Number(formData.get("drop_weight") ?? "1");

  if (seedItemId.length === 0 || plantId.length === 0) return;
  if (!Number.isInteger(dropWeight) || dropWeight < 1) return;

  await supabase
    .from("seed_plants")
    .upsert(
      { seed_item_id: seedItemId, plant_id: plantId, drop_weight: dropWeight },
      { onConflict: "seed_item_id,plant_id" },
    );

  revalidatePath(`/admin/items/${seedItemId}`);
}

export async function removeSeedPoolEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const seedItemId = String(formData.get("seed_item_id") ?? "");
  const plantId = String(formData.get("plant_id") ?? "");
  if (seedItemId.length === 0 || plantId.length === 0) return;

  await supabase.from("seed_plants").delete().eq("seed_item_id", seedItemId).eq("plant_id", plantId);

  revalidatePath(`/admin/items/${seedItemId}`);
}

// ── Fertilizer effects (a 'fertilizer' item's fertilizer_effects rows) ──
const FERTILIZER_EFFECT_TYPES: FertilizerEffectType[] = [
  "grow_speed_boost",
  "pest_deterrence",
  "double_coin_chance",
];

export async function addFertilizerEffect(formData: FormData) {
  const { supabase } = await requireAdmin();

  const itemId = String(formData.get("item_id") ?? "");
  const effectType = String(formData.get("effect_type") ?? "");
  const effectMagnitude = Number(formData.get("effect_magnitude") ?? "");

  if (itemId.length === 0) return;
  if (!FERTILIZER_EFFECT_TYPES.includes(effectType as FertilizerEffectType)) return;
  if (!Number.isFinite(effectMagnitude) || effectMagnitude <= 0) return;

  await supabase
    .from("fertilizer_effects")
    .upsert(
      { item_id: itemId, effect_type: effectType as FertilizerEffectType, effect_magnitude: effectMagnitude },
      { onConflict: "item_id,effect_type" },
    );

  revalidatePath(`/admin/items/${itemId}`);
}

export async function removeFertilizerEffect(formData: FormData) {
  const { supabase } = await requireAdmin();

  const itemId = String(formData.get("item_id") ?? "");
  const effectType = String(formData.get("effect_type") ?? "");
  if (itemId.length === 0 || !FERTILIZER_EFFECT_TYPES.includes(effectType as FertilizerEffectType)) return;

  await supabase
    .from("fertilizer_effects")
    .delete()
    .eq("item_id", itemId)
    .eq("effect_type", effectType as FertilizerEffectType);

  revalidatePath(`/admin/items/${itemId}`);
}
