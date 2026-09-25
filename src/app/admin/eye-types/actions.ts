"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { TraitRarity } from "@/lib/supabase/types";

const TRAIT_RARITIES: TraitRarity[] = ["common", "uncommon", "rare"];

export type EyeTypeFormState = { error: string } | null;

function readEyeTypeFields(formData: FormData) {
  const breedId = String(formData.get("breed_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const rarityTier = String(formData.get("rarity_tier") ?? "");
  const layerUrl = String(formData.get("layer_url") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (breedId.length === 0) return { ok: false as const, error: "A breed is required." };
  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };
  if (!TRAIT_RARITIES.includes(rarityTier as TraitRarity)) {
    return { ok: false as const, error: "Invalid rarity tier." };
  }

  return {
    ok: true as const,
    fields: {
      breed_id: breedId,
      name,
      rarity_tier: rarityTier as TraitRarity,
      layer_url: layerUrl.length > 0 ? layerUrl : null,
      is_active: isActive,
    },
  };
}

export async function createEyeType(
  _prevState: EyeTypeFormState,
  formData: FormData,
): Promise<EyeTypeFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readEyeTypeFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("eye_types").insert(parsed.fields);
  if (error) return { error: `Could not create eye type: ${error.message}` };

  revalidatePath("/admin/eye-types");
  redirect("/admin/eye-types");
}

export async function updateEyeType(
  _prevState: EyeTypeFormState,
  formData: FormData,
): Promise<EyeTypeFormState> {
  const { supabase } = await requireAdmin();

  const eyeTypeId = String(formData.get("eye_type_id") ?? "");
  if (eyeTypeId.length === 0) return { error: "Missing eye type id." };

  const parsed = readEyeTypeFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("eye_types").update(parsed.fields).eq("id", eyeTypeId);
  if (error) return { error: `Could not save eye type: ${error.message}` };

  revalidatePath("/admin/eye-types");
  redirect("/admin/eye-types");
}
