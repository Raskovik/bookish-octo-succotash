"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { uploadGameImage } from "@/lib/game-image-upload";

export type SpeciesFormState = { error: string } | null;

function readSpeciesFields(formData: FormData) {
  const breedId = String(formData.get("breed_id") ?? "").trim();
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (breedId.length === 0) return { ok: false as const, error: "Choose a breed." };

  return {
    ok: true as const,
    fields: {
      breed_id: breedId,
      image_url: imageUrlRaw.length > 0 ? imageUrlRaw : null,
      is_active: isActive,
    },
  };
}

export async function createSpecies(
  _prevState: SpeciesFormState,
  formData: FormData,
): Promise<SpeciesFormState> {
  const { supabase } = await requireAdmin();

  const parsed = readSpeciesFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  // name/model_number aren't passed — set_species_name_from_model_number()
  // assigns both automatically on insert (see
  // 0068_breeds_and_model_numbers_drop_pet_rarity.sql).
  const { data, error } = await supabase
    .from("species")
    .insert(parsed.fields)
    .select("id")
    .single();
  if (error || !data) {
    return { error: `Could not create model: ${error?.message ?? "unknown error"}` };
  }

  const imageFile = formData.get("image_file");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploadedUrl = await uploadGameImage(supabase, "species", data.id, imageFile);
      if (uploadedUrl) {
        await supabase.from("species").update({ image_url: uploadedUrl }).eq("id", data.id);
      }
    } catch (uploadError) {
      return {
        error: `Model created, but the image upload failed: ${
          uploadError instanceof Error ? uploadError.message : "unknown error"
        }`,
      };
    }
  }

  revalidatePath("/admin/species");
  redirect("/admin/species");
}

export async function updateSpecies(
  _prevState: SpeciesFormState,
  formData: FormData,
): Promise<SpeciesFormState> {
  const { supabase } = await requireAdmin();

  const speciesId = String(formData.get("species_id") ?? "");
  if (speciesId.length === 0) return { error: "Missing model id." };

  const parsed = readSpeciesFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const imageFile = formData.get("image_file");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploadedUrl = await uploadGameImage(supabase, "species", speciesId, imageFile);
      if (uploadedUrl) {
        parsed.fields.image_url = uploadedUrl;
      }
    } catch (uploadError) {
      return {
        error: uploadError instanceof Error ? uploadError.message : "Image upload failed.",
      };
    }
  }

  const { error } = await supabase.from("species").update(parsed.fields).eq("id", speciesId);
  if (error) {
    return { error: `Could not save model: ${error.message}` };
  }

  revalidatePath("/admin/species");
  redirect("/admin/species");
}
