import { requireAdmin } from "@/lib/admin";
import { EyeTypeForm } from "../eye-type-form";
import { createEyeType } from "../actions";

export default async function NewEyeTypePage() {
  const { supabase } = await requireAdmin();

  const { data: breeds } = await supabase.from("breeds").select("id, name").eq("is_active", true).order("name");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New eye type</h2>
      <EyeTypeForm action={createEyeType} submitLabel="Create eye type" breedOptions={breeds ?? []} />
    </div>
  );
}
