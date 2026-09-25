import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { PatternForm } from "../pattern-form";
import { updatePattern } from "../actions";

export default async function EditPatternPage(props: PageProps<"/admin/patterns/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: pattern }, { data: breeds }] = await Promise.all([
    supabase
      .from("patterns")
      .select("id, breed_id, name, rarity_tier, layer_url, is_active, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("breeds").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (!pattern) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit pattern</h2>
      <PatternForm action={updatePattern} pattern={pattern} submitLabel="Save changes" breedOptions={breeds ?? []} />
    </div>
  );
}
