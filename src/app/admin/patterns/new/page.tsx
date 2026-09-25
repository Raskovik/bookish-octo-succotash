import { requireAdmin } from "@/lib/admin";
import { PatternForm } from "../pattern-form";
import { createPattern } from "../actions";

export default async function NewPatternPage() {
  const { supabase } = await requireAdmin();

  const { data: breeds } = await supabase.from("breeds").select("id, name").eq("is_active", true).order("name");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New pattern</h2>
      <PatternForm action={createPattern} submitLabel="Create pattern" breedOptions={breeds ?? []} />
    </div>
  );
}
