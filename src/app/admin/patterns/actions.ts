"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { TraitRarity } from "@/lib/supabase/types";

const TRAIT_RARITIES: TraitRarity[] = ["common", "uncommon", "rare"];

export type PatternFormState = { error: string } | null;

function readPatternFields(formData: FormData) {
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

export async function createPattern(
  _prevState: PatternFormState,
  formData: FormData,
): Promise<PatternFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readPatternFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("patterns").insert(parsed.fields);
  if (error) return { error: `Could not create pattern: ${error.message}` };

  revalidatePath("/admin/patterns");
  redirect("/admin/patterns");
}

export async function updatePattern(
  _prevState: PatternFormState,
  formData: FormData,
): Promise<PatternFormState> {
  const { supabase } = await requireAdmin();

  const patternId = String(formData.get("pattern_id") ?? "");
  if (patternId.length === 0) return { error: "Missing pattern id." };

  const parsed = readPatternFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("patterns").update(parsed.fields).eq("id", patternId);
  if (error) return { error: `Could not save pattern: ${error.message}` };

  revalidatePath("/admin/patterns");
  redirect("/admin/patterns");
}
