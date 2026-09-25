"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { TraitRarity } from "@/lib/supabase/types";

const TRAIT_RARITIES: TraitRarity[] = ["common", "uncommon", "rare"];

export type ColorFormState = { error: string } | null;

function readColorFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const hexSwatch = String(formData.get("hex_swatch") ?? "").trim();
  const rarityTier = String(formData.get("rarity_tier") ?? "");
  const isActive = formData.get("is_active") === "on";

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };
  if (!/^#[0-9a-fA-F]{6}$/.test(hexSwatch)) {
    return { ok: false as const, error: "Hex swatch must look like #rrggbb." };
  }
  if (!TRAIT_RARITIES.includes(rarityTier as TraitRarity)) {
    return { ok: false as const, error: "Invalid rarity tier." };
  }

  return {
    ok: true as const,
    fields: { name, hex_swatch: hexSwatch, rarity_tier: rarityTier as TraitRarity, is_active: isActive },
  };
}

export async function createColor(
  _prevState: ColorFormState,
  formData: FormData,
): Promise<ColorFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readColorFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("colors").insert(parsed.fields);
  if (error) return { error: `Could not create color: ${error.message}` };

  revalidatePath("/admin/colors");
  redirect("/admin/colors");
}

export async function updateColor(
  _prevState: ColorFormState,
  formData: FormData,
): Promise<ColorFormState> {
  const { supabase } = await requireAdmin();

  const colorId = String(formData.get("color_id") ?? "");
  if (colorId.length === 0) return { error: "Missing color id." };

  const parsed = readColorFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("colors").update(parsed.fields).eq("id", colorId);
  if (error) return { error: `Could not save color: ${error.message}` };

  revalidatePath("/admin/colors");
  redirect("/admin/colors");
}
