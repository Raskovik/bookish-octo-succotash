import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { EyeTypeForm } from "../eye-type-form";
import { updateEyeType } from "../actions";

export default async function EditEyeTypePage(props: PageProps<"/admin/eye-types/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: eyeType }, { data: breeds }] = await Promise.all([
    supabase
      .from("eye_types")
      .select("id, breed_id, name, rarity_tier, layer_url, is_active, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("breeds").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (!eyeType) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit eye type</h2>
      <EyeTypeForm action={updateEyeType} eyeType={eyeType} submitLabel="Save changes" breedOptions={breeds ?? []} />
    </div>
  );
}
