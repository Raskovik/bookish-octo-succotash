import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { GARDEN_ENABLED } from "@/lib/feature-flags";
import { GardenPlantForm } from "../garden-plant-form";
import { createGardenPlant } from "../actions";

export default async function NewGardenPlantPage() {
  if (!GARDEN_ENABLED) {
    notFound();
  }

  const { supabase } = await requireAdmin();

  const { data: items } = await supabase.from("items").select("id, name").eq("is_active", true).order("name");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New garden plant</h2>
      <GardenPlantForm
        action={createGardenPlant}
        submitLabel="Create plant"
        produceItemOptions={(items ?? []).map((i) => ({ id: i.id, label: i.name }))}
      />
    </div>
  );
}
