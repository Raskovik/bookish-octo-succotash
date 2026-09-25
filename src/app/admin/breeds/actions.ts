"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { compositePetImage } from "@/lib/pet-compositor";
import crypto from "node:crypto";

export type BreedFormState = { error: string } | null;

function readBreedFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rarityWeightRaw = String(formData.get("rarity_weight") ?? "");
  const baseLayerUrl = String(formData.get("base_layer_url") ?? "").trim();
  const maskLayerUrl = String(formData.get("mask_layer_url") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };

  const rarityWeight = Number(rarityWeightRaw);
  if (!Number.isInteger(rarityWeight) || rarityWeight < 1) {
    return { ok: false as const, error: "Rarity weight must be a whole number of at least 1." };
  }

  return {
    ok: true as const,
    fields: {
      name,
      description: description.length > 0 ? description : null,
      rarity_weight: rarityWeight,
      base_layer_url: baseLayerUrl.length > 0 ? baseLayerUrl : null,
      mask_layer_url: maskLayerUrl.length > 0 ? maskLayerUrl : null,
      is_active: isActive,
    },
  };
}

export async function createBreed(
  _prevState: BreedFormState,
  formData: FormData,
): Promise<BreedFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readBreedFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("breeds").insert(parsed.fields);
  if (error) {
    return { error: `Could not create breed: ${error.message}` };
  }

  revalidatePath("/admin/breeds");
  redirect("/admin/breeds");
}

// "Preview a random pet" (Section 6 of the breeding spec doc) — rolls one
// wild trait combo for this breed and composites it on the spot, so an
// admin can sanity-check the breed's full visual range (mask alignment,
// color-region boundaries) before any of it reaches a player. Uploaded
// under previews/ (admin-only write path, see
// 0039_composited_pets_storage.sql) rather than the owner-scoped pets/
// path — this preview isn't tied to any actual pet.
export async function previewRandomBreedPet(
  breedId: string,
): Promise<{ imageUrl: string } | { error: string }> {
  const { supabase } = await requireAdmin();

  const { data: breed } = await supabase
    .from("breeds")
    .select("base_layer_url, mask_layer_url")
    .eq("id", breedId)
    .maybeSingle();

  if (!breed) return { error: "Breed not found." };
  if (!breed.base_layer_url) return { error: "This breed has no base line-art yet." };

  const { data: traits, error: rollError } = await supabase
    .rpc("roll_wild_traits", { p_breed_id: breedId })
    .single();

  if (rollError || !traits) {
    return { error: rollError?.message ?? "Couldn't roll a trait combination — add some colors/patterns/eye types first." };
  }

  const [primary, secondary, tertiary, pattern, eyeType] = await Promise.all([
    traits.primary_color_id
      ? supabase.from("colors").select("hex_swatch").eq("id", traits.primary_color_id).maybeSingle()
      : Promise.resolve({ data: null }),
    traits.secondary_color_id
      ? supabase.from("colors").select("hex_swatch").eq("id", traits.secondary_color_id).maybeSingle()
      : Promise.resolve({ data: null }),
    traits.tertiary_color_id
      ? supabase.from("colors").select("hex_swatch").eq("id", traits.tertiary_color_id).maybeSingle()
      : Promise.resolve({ data: null }),
    traits.pattern_id
      ? supabase.from("patterns").select("layer_url").eq("id", traits.pattern_id).maybeSingle()
      : Promise.resolve({ data: null }),
    traits.eye_type_id
      ? supabase.from("eye_types").select("layer_url").eq("id", traits.eye_type_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  try {
    const buffer = await compositePetImage({
      breedId,
      baseLayerUrl: breed.base_layer_url,
      maskLayerUrl: breed.mask_layer_url,
      primaryColorHex: primary.data?.hex_swatch ?? null,
      secondaryColorHex: secondary.data?.hex_swatch ?? null,
      tertiaryColorHex: tertiary.data?.hex_swatch ?? null,
      patternLayerUrl: pattern.data?.layer_url ?? null,
      eyeLayerUrl: eyeType.data?.layer_url ?? null,
    });

    const path = `previews/${breedId}-${crypto.randomBytes(6).toString("hex")}.png`;
    const { error: uploadError } = await supabase.storage.from("composited-pets").upload(path, buffer, {
      upsert: true,
      contentType: "image/png",
    });
    if (uploadError) return { error: `Composited, but upload failed: ${uploadError.message}` };

    const {
      data: { publicUrl },
    } = supabase.storage.from("composited-pets").getPublicUrl(path);

    return { imageUrl: `${publicUrl}?v=${Date.now()}` };
  } catch (compositeError) {
    return {
      error: compositeError instanceof Error ? compositeError.message : "Compositing failed.",
    };
  }
}

export async function updateBreed(
  _prevState: BreedFormState,
  formData: FormData,
): Promise<BreedFormState> {
  const { supabase } = await requireAdmin();

  const breedId = String(formData.get("breed_id") ?? "");
  if (breedId.length === 0) return { error: "Missing breed id." };

  const parsed = readBreedFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("breeds").update(parsed.fields).eq("id", breedId);
  if (error) {
    return { error: `Could not save breed: ${error.message}` };
  }

  revalidatePath("/admin/breeds");
  redirect("/admin/breeds");
}
