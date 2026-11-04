import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { GARDEN_ENABLED } from "@/lib/feature-flags";
import { GardenPlantForm } from "../garden-plant-form";
import { updateGardenPlant } from "../actions";

export default async function EditGardenPlantPage(props: PageProps<"/admin/garden-plants/[id]">) {
  if (!GARDEN_ENABLED) {
    notFound();
  }

  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: plant }, { data: items }] = await Promise.all([
    supabase
      .from("garden_plants")
      .select(
        "id, name, image_stage1_url, image_stage2_url, image_stage3_url, image_stage4_url, produce_item_id, produce_quantity_min, produce_quantity_max, base_coin_yield, is_active, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("items").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (!plant) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit garden plant</h2>
      <GardenPlantForm
        action={updateGardenPlant}
        plant={plant}
        submitLabel="Save changes"
        produceItemOptions={(items ?? []).map((i) => ({ id: i.id, label: i.name }))}
      />
    </div>
  );
}
