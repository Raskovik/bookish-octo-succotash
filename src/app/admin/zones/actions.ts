"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { uploadGameImage } from "@/lib/game-image-upload";

export type ZoneFormState = { error: string } | null;

// is_tutorial is deliberately never read from form input here — it's set
// once by the seed migration for the single tutorial zone and isn't meant
// to be reassignable from the admin panel. Map position (map_x/y/width/
// height) is likewise never read here — per the admin redesign, a new
// zone's map hotspot is positioned directly in the database by whoever
// adds it, not through this form; see ZoneRow's comment in types.ts.
function readZoneFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  const rewardCoinsBaseRaw = String(formData.get("reward_coins_base") ?? "");
  const rewardCoinsVarianceRaw = String(formData.get("reward_coins_variance") ?? "");
  const rewardXpRaw = String(formData.get("reward_xp") ?? "");
  const isActive = formData.get("is_active") === "on";

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };

  const rewardCoinsBase = Number(rewardCoinsBaseRaw);
  if (!Number.isInteger(rewardCoinsBase) || rewardCoinsBase < 0) {
    return { ok: false as const, error: "Base coin reward must be a non-negative whole number." };
  }

  const rewardCoinsVariance = Number(rewardCoinsVarianceRaw);
  if (!Number.isInteger(rewardCoinsVariance) || rewardCoinsVariance < 0) {
    return { ok: false as const, error: "Coin variance must be a non-negative whole number." };
  }

  const rewardXp = Number(rewardXpRaw);
  if (!Number.isInteger(rewardXp) || rewardXp < 0) {
    return { ok: false as const, error: "XP reward must be a non-negative whole number." };
  }

  return {
    ok: true as const,
    fields: {
      name,
      description: descriptionRaw.length > 0 ? descriptionRaw : null,
      image_url: imageUrlRaw.length > 0 ? imageUrlRaw : null,
      reward_coins_base: rewardCoinsBase,
      reward_coins_variance: rewardCoinsVariance,
      reward_xp: rewardXp,
      is_active: isActive,
    },
  };
}

export async function createZone(
  _prevState: ZoneFormState,
  formData: FormData,
): Promise<ZoneFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readZoneFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { data, error } = await supabase
    .from("zones")
    .insert(parsed.fields)
    .select("id")
    .single();

  if (error || !data) {
    return { error: `Could not create zone: ${error?.message ?? "unknown error"}` };
  }

  const imageFile = formData.get("image_file");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploadedUrl = await uploadGameImage(supabase, "zones", data.id, imageFile);
      if (uploadedUrl) {
        await supabase.from("zones").update({ image_url: uploadedUrl }).eq("id", data.id);
      }
    } catch (uploadError) {
      return {
        error: `Zone created, but the image upload failed: ${
          uploadError instanceof Error ? uploadError.message : "unknown error"
        }`,
      };
    }
  }

  revalidatePath("/admin/zones");
  redirect(`/admin/zones/${data.id}`);
}

export async function updateZone(
  _prevState: ZoneFormState,
  formData: FormData,
): Promise<ZoneFormState> {
  const { supabase } = await requireAdmin();

  const zoneId = String(formData.get("zone_id") ?? "");
  if (zoneId.length === 0) return { error: "Missing zone id." };

  const parsed = readZoneFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const imageFile = formData.get("image_file");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploadedUrl = await uploadGameImage(supabase, "zones", zoneId, imageFile);
      if (uploadedUrl) {
        parsed.fields.image_url = uploadedUrl;
      }
    } catch (uploadError) {
      return {
        error: uploadError instanceof Error ? uploadError.message : "Image upload failed.",
      };
    }
  }

  const { error } = await supabase.from("zones").update(parsed.fields).eq("id", zoneId);
  if (error) {
    return { error: `Could not save zone: ${error.message}` };
  }

  revalidatePath("/admin/zones");
  revalidatePath(`/admin/zones/${zoneId}`);
  return null;
}

export async function addPoolEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const zoneId = String(formData.get("zone_id") ?? "");
  const speciesId = String(formData.get("species_id") ?? "");
  const dropWeight = Number(formData.get("drop_weight") ?? "1");

  if (zoneId.length === 0 || speciesId.length === 0) return;
  if (!Number.isInteger(dropWeight) || dropWeight < 1) return;

  await supabase
    .from("zone_pet_pool")
    .upsert(
      { zone_id: zoneId, species_id: speciesId, drop_weight: dropWeight },
      { onConflict: "zone_id,species_id" },
    );

  revalidatePath(`/admin/zones/${zoneId}`);
}

export async function removePoolEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const zoneId = String(formData.get("zone_id") ?? "");
  const speciesId = String(formData.get("species_id") ?? "");
  if (zoneId.length === 0 || speciesId.length === 0) return;

  await supabase.from("zone_pet_pool").delete().eq("zone_id", zoneId).eq("species_id", speciesId);

  revalidatePath(`/admin/zones/${zoneId}`);
}

// Loot entries key on (zone_id, item_id, amount) — the same item can
// appear in the pool more than once at different amounts (e.g. "10
// Blueberries" and "5 Blueberries" as two independently-weighted rows).
// Adding the same item+amount pair again upserts onto that exact row
// (updating its weight) instead of erroring or creating a duplicate.
export async function addLootEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const zoneId = String(formData.get("zone_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const amount = Number(formData.get("amount") ?? "1");
  const dropWeight = Number(formData.get("drop_weight") ?? "1");

  if (zoneId.length === 0 || itemId.length === 0) return;
  if (!Number.isInteger(amount) || amount < 1) return;
  if (!Number.isInteger(dropWeight) || dropWeight < 1) return;

  await supabase
    .from("zone_loot_table")
    .upsert(
      { zone_id: zoneId, item_id: itemId, amount, drop_weight: dropWeight },
      { onConflict: "zone_id,item_id,amount" },
    );

  revalidatePath(`/admin/zones/${zoneId}`);
}

export async function removeLootEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const zoneId = String(formData.get("zone_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const amount = Number(formData.get("amount") ?? "");
  if (zoneId.length === 0 || itemId.length === 0 || !Number.isInteger(amount)) return;

  await supabase
    .from("zone_loot_table")
    .delete()
    .eq("zone_id", zoneId)
    .eq("item_id", itemId)
    .eq("amount", amount);

  revalidatePath(`/admin/zones/${zoneId}`);
}
