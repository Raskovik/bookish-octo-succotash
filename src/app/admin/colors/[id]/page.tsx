import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { ColorForm } from "../color-form";
import { updateColor } from "../actions";

export default async function EditColorPage(props: PageProps<"/admin/colors/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: color } = await supabase
    .from("colors")
    .select("id, name, hex_swatch, rarity_tier, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!color) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit color</h2>
      <ColorForm action={updateColor} color={color} submitLabel="Save changes" />
    </div>
  );
}
