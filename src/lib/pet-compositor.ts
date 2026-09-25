import sharp, { type OverlayOptions } from "sharp";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Server-side compositing (Section 3 of the breeding spec doc) — runs in
// Node (this file uses `sharp`, which has no edge-runtime build), never
// in the browser: keeps /pets and /pets/[petId] a plain <img> with no
// client canvas cost, and lets identical trait combinations reuse one
// cached file instead of every viewer re-compositing the same pet.
//
// Layer stack, back to front: breed base line-art -> primary/secondary/
// tertiary color fills -> pattern overlay -> eye-type overlay. The color
// fills are masked by ONE region-mask image (breeds.mask_layer_url)
// whose R/G/B channels each define one region's coverage — a standard
// technique for multi-region recolor without needing three separate mask
// files. Every fetch/composite step below is real, general-purpose image
// logic, not placeholder-specific — it just has nothing meaningful to
// look at yet, same as every other placehold.co-backed catalog in this
// project until real art lands in game-assets/.

export type PetTraitLayers = {
  breedId: string;
  baseLayerUrl: string | null;
  maskLayerUrl: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  tertiaryColorHex: string | null;
  patternLayerUrl: string | null;
  eyeLayerUrl: string | null;
};

export type TraitComboKey = {
  breedId: string;
  primaryColorId: string | null;
  secondaryColorId: string | null;
  tertiaryColorId: string | null;
  patternId: string | null;
  eyeTypeId: string | null;
};

// Deterministic cache key from the trait combination itself (not a pet
// id) — see the storage bucket migration's comment for why the actual
// upload path is additionally scoped by owner, even though the hash
// itself is combo-based.
export function traitComboCacheKey(traits: TraitComboKey): string {
  const raw = [
    traits.breedId,
    traits.primaryColorId ?? "",
    traits.secondaryColorId ?? "",
    traits.tertiaryColorId ?? "",
    traits.patternId ?? "",
    traits.eyeTypeId ?? "",
  ].join(":");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch layer image (${res.status}): ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// One region-mask channel (0=R/primary, 1=G/secondary, 2=B/tertiary)
// becomes the alpha channel of a solid-color fill the same size as the
// base — so it composites as "this color, but only where the mask says
// this region is."
async function tintFromMaskChannel(
  maskBuffer: Buffer,
  channelIndex: 0 | 1 | 2,
  hex: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const alpha = await sharp(maskBuffer).resize(width, height).extractChannel(channelIndex).toBuffer();
  const solid = await sharp({ create: { width, height, channels: 4, background: hex } })
    .png()
    .toBuffer();
  return sharp(solid).joinChannel(alpha).png().toBuffer();
}

// The actual compositing math, taking already-fetched buffers — kept
// separate from compositePetImage() (which fetches over the network) so
// it can be exercised directly (e.g. from a verification script) without
// needing network access to real layer art.
export async function compositeFromBuffers(params: {
  baseBuffer: Buffer;
  maskBuffer: Buffer | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  tertiaryColorHex: string | null;
  patternBuffer: Buffer | null;
  eyeBuffer: Buffer | null;
}): Promise<Buffer> {
  const baseMeta = await sharp(params.baseBuffer).metadata();
  const width = baseMeta.width ?? 600;
  const height = baseMeta.height ?? 600;

  const layers: OverlayOptions[] = [];

  if (params.maskBuffer) {
    if (params.primaryColorHex) {
      layers.push({ input: await tintFromMaskChannel(params.maskBuffer, 0, params.primaryColorHex, width, height) });
    }
    if (params.secondaryColorHex) {
      layers.push({ input: await tintFromMaskChannel(params.maskBuffer, 1, params.secondaryColorHex, width, height) });
    }
    if (params.tertiaryColorHex) {
      layers.push({ input: await tintFromMaskChannel(params.maskBuffer, 2, params.tertiaryColorHex, width, height) });
    }
  }

  if (params.patternBuffer) {
    layers.push({ input: await sharp(params.patternBuffer).resize(width, height).toBuffer() });
  }
  if (params.eyeBuffer) {
    layers.push({ input: await sharp(params.eyeBuffer).resize(width, height).toBuffer() });
  }

  return sharp(params.baseBuffer).resize(width, height).composite(layers).png().toBuffer();
}

export async function compositePetImage(traits: PetTraitLayers): Promise<Buffer> {
  if (!traits.baseLayerUrl) {
    throw new Error("This breed has no base line-art configured yet.");
  }

  const [baseBuffer, maskBuffer, patternBuffer, eyeBuffer] = await Promise.all([
    fetchImageBuffer(traits.baseLayerUrl),
    traits.maskLayerUrl ? fetchImageBuffer(traits.maskLayerUrl) : Promise.resolve(null),
    traits.patternLayerUrl ? fetchImageBuffer(traits.patternLayerUrl) : Promise.resolve(null),
    traits.eyeLayerUrl ? fetchImageBuffer(traits.eyeLayerUrl) : Promise.resolve(null),
  ]);

  return compositeFromBuffers({
    baseBuffer,
    maskBuffer,
    primaryColorHex: traits.primaryColorHex,
    secondaryColorHex: traits.secondaryColorHex,
    tertiaryColorHex: traits.tertiaryColorHex,
    patternBuffer,
    eyeBuffer,
  });
}

type PetTraitRow = {
  id: string;
  breed_id: string | null;
  primary_color_id: string | null;
  secondary_color_id: string | null;
  tertiary_color_id: string | null;
  pattern_id: string | null;
  eye_type_id: string | null;
};

/**
 * Composites and persists composited_image_url for every trait-based pet
 * the given user owns that doesn't have one yet — the Node-side half of
 * pet creation, called right after any RPC that can create a trait-based
 * pet (grant_starter_pet_and_tutorial, resolve_due_expeditions' tutorial
 * branch, claim_egg). The Postgres RPCs themselves can't call `sharp` or
 * Supabase Storage, so they create the row with composited_image_url
 * null and this fills it in afterward — set_pet_composited_image()
 * (0038_trait_breeding_schema.sql) only accepts the write once per pet,
 * so a failed/retried call here can't stomp on a value already set.
 */
export async function compositeMissingPetImages(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data: pending } = await supabase
    .from("pets")
    .select("id, breed_id, primary_color_id, secondary_color_id, tertiary_color_id, pattern_id, eye_type_id")
    .eq("owner_id", userId)
    .is("composited_image_url", null)
    .not("breed_id", "is", null);

  const pendingPets = (pending ?? []) as PetTraitRow[];
  if (pendingPets.length === 0) return;

  const breedIds = [...new Set(pendingPets.map((p) => p.breed_id!))];
  const colorIds = [
    ...new Set(
      pendingPets.flatMap((p) => [p.primary_color_id, p.secondary_color_id, p.tertiary_color_id]).filter((id): id is string => !!id),
    ),
  ];
  const patternIds = [...new Set(pendingPets.map((p) => p.pattern_id).filter((id): id is string => !!id))];
  const eyeTypeIds = [...new Set(pendingPets.map((p) => p.eye_type_id).filter((id): id is string => !!id))];

  const [{ data: breeds }, { data: colors }, { data: patterns }, { data: eyeTypes }] = await Promise.all([
    supabase.from("breeds").select("id, base_layer_url, mask_layer_url").in("id", breedIds),
    colorIds.length > 0
      ? supabase.from("colors").select("id, hex_swatch").in("id", colorIds)
      : Promise.resolve({ data: [] }),
    patternIds.length > 0
      ? supabase.from("patterns").select("id, layer_url").in("id", patternIds)
      : Promise.resolve({ data: [] }),
    eyeTypeIds.length > 0
      ? supabase.from("eye_types").select("id, layer_url").in("id", eyeTypeIds)
      : Promise.resolve({ data: [] }),
  ]);

  const breedById = new Map((breeds ?? []).map((b) => [b.id, b]));
  const hexById = new Map((colors ?? []).map((c) => [c.id, c.hex_swatch]));
  const patternUrlById = new Map((patterns ?? []).map((p) => [p.id, p.layer_url]));
  const eyeUrlById = new Map((eyeTypes ?? []).map((e) => [e.id, e.layer_url]));

  for (const pet of pendingPets) {
    const breed = pet.breed_id ? breedById.get(pet.breed_id) : undefined;
    if (!breed) continue;

    try {
      const buffer = await compositePetImage({
        breedId: pet.breed_id!,
        baseLayerUrl: breed.base_layer_url,
        maskLayerUrl: breed.mask_layer_url,
        primaryColorHex: pet.primary_color_id ? (hexById.get(pet.primary_color_id) ?? null) : null,
        secondaryColorHex: pet.secondary_color_id ? (hexById.get(pet.secondary_color_id) ?? null) : null,
        tertiaryColorHex: pet.tertiary_color_id ? (hexById.get(pet.tertiary_color_id) ?? null) : null,
        patternLayerUrl: pet.pattern_id ? (patternUrlById.get(pet.pattern_id) ?? null) : null,
        eyeLayerUrl: pet.eye_type_id ? (eyeUrlById.get(pet.eye_type_id) ?? null) : null,
      });

      const cacheKey = traitComboCacheKey({
        breedId: pet.breed_id!,
        primaryColorId: pet.primary_color_id,
        secondaryColorId: pet.secondary_color_id,
        tertiaryColorId: pet.tertiary_color_id,
        patternId: pet.pattern_id,
        eyeTypeId: pet.eye_type_id,
      });
      const path = `pets/${userId}/${cacheKey}.png`;

      const { error: uploadError } = await supabase.storage.from("composited-pets").upload(path, buffer, {
        upsert: true,
        contentType: "image/png",
      });
      if (uploadError) continue;

      const {
        data: { publicUrl },
      } = supabase.storage.from("composited-pets").getPublicUrl(path);

      await supabase.rpc("set_pet_composited_image", {
        p_user_id: userId,
        p_pet_id: pet.id,
        p_image_url: `${publicUrl}?v=${Date.now()}`,
      });
    } catch {
      // A missing/unreachable layer image (e.g. no real art configured
      // yet) leaves this pet's composited_image_url null — the display
      // layer falls back to a placeholder box, same as any other
      // missing image_url in this app. Retried on the next page load
      // that calls compositeMissingPetImages again.
    }
  }
}
