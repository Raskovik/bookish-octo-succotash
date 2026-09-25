import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { BreedForm } from "../breed-form";
import { RandomPetPreviewButton } from "../random-pet-preview-button";
import { updateBreed } from "../actions";

export default async function EditBreedPage(props: PageProps<"/admin/breeds/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: breed } = await supabase
    .from("breeds")
    .select("id, name, description, rarity_weight, base_layer_url, mask_layer_url, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!breed) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Edit breed</h2>
        <BreedForm action={updateBreed} breed={breed} submitLabel="Save changes" />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold tracking-tight">Preview</h3>
        <p className="text-sm text-stone-500">
          Rolls a random wild trait combination for this breed and composites it, so you can catch a misaligned mask
          or bad color-region boundary before it reaches a player.
        </p>
        <RandomPetPreviewButton breedId={breed.id} />
      </div>
    </div>
  );
}
