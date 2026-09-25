"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type ZoneFormState = { error: string } | null;

// is_tutorial is deliberately never read from form input here — it's set
// once by the seed migration for the single tutorial zone and isn't meant
// to be reassignable from the admin panel.
function readZoneFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const tierRaw = String(formData.get("tier") ?? "");
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  const unlockRequirementRaw = String(formData.get("unlock_requirement") ?? "").trim();
  const isActive = formData.get("is_active") === "on";
  const mapXRaw = String(formData.get("map_x") ?? "");
  const mapYRaw = String(formData.get("map_y") ?? "");
  const mapWidthRaw = String(formData.get("map_width") ?? "");
  const mapHeightRaw = String(formData.get("map_height") ?? "");

  if (name.length === 0) return { ok: false as const, error: "Name can't be empty." };

  const tier = Number(tierRaw);
  if (!Number.isInteger(tier) || tier < 1) {
    return { ok: false as const, error: "Tier must be a whole number of 1 or more." };
  }

  const mapFields: Record<string, number | null> = {};
  for (const [key, raw] of [
    ["map_x", mapXRaw],
    ["map_y", mapYRaw],
    ["map_width", mapWidthRaw],
    ["map_height", mapHeightRaw],
  ] as const) {
    if (raw.trim().length === 0) {
      mapFields[key] = null;
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return {
        ok: false as const,
        error: `${key.replace("map_", "Map ")} must be a percentage between 0 and 100.`,
      };
    }
    mapFields[key] = value;
  }

  return {
    ok: true as const,
    fields: {
      name,
      tier,
      description: descriptionRaw.length > 0 ? descriptionRaw : null,
      image_url: imageUrlRaw.length > 0 ? imageUrlRaw : null,
      unlock_requirement: unlockRequirementRaw.length > 0 ? unlockRequirementRaw : null,
      is_active: isActive,
      map_x: mapFields.map_x,
      map_y: mapFields.map_y,
      map_width: mapFields.map_width,
      map_height: mapFields.map_height,
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

  const { error } = await supabase.from("zones").update(parsed.fields).eq("id", zoneId);
  if (error) {
    return { error: `Could not save zone: ${error.message}` };
  }

  revalidatePath("/admin/zones");
  revalidatePath(`/admin/zones/${zoneId}`);
  return null;
}

export async function addLootEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const zoneId = String(formData.get("zone_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const dropWeight = Number(formData.get("drop_weight") ?? "1");

  if (zoneId.length === 0 || itemId.length === 0) return;
  if (!Number.isInteger(dropWeight) || dropWeight < 1) return;

  await supabase
    .from("zone_loot_table")
    .upsert(
      { zone_id: zoneId, item_id: itemId, drop_weight: dropWeight },
      { onConflict: "zone_id,item_id" },
    );

  revalidatePath(`/admin/zones/${zoneId}`);
}

export async function removeLootEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const zoneId = String(formData.get("zone_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  if (zoneId.length === 0 || itemId.length === 0) return;

  await supabase.from("zone_loot_table").delete().eq("zone_id", zoneId).eq("item_id", itemId);

  revalidatePath(`/admin/zones/${zoneId}`);
}
