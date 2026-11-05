import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { SpeciesForm } from "../species-form";
import { updateSpecies } from "../actions";

export default async function EditSpeciesPage(props: PageProps<"/admin/species/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: species }, { data: breeds }] = await Promise.all([
    supabase
      .from("species")
      .select("id, name, breed_id, model_number, image_url, is_active, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("breeds").select("id, name").order("name"),
  ]);

  if (!species) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit model</h2>
      <SpeciesForm action={updateSpecies} species={species} breeds={breeds ?? []} submitLabel="Save changes" />
    </div>
  );
}
