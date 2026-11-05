import { requireAdmin } from "@/lib/admin";
import { SpeciesForm } from "../species-form";
import { createSpecies } from "../actions";

export default async function NewSpeciesPage() {
  const { supabase } = await requireAdmin();

  const { data: breeds } = await supabase.from("breeds").select("id, name").order("name");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New model</h2>
      <SpeciesForm action={createSpecies} breeds={breeds ?? []} submitLabel="Create model" />
    </div>
  );
}
