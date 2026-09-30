import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { BREWING_ENABLED } from "@/lib/feature-flags";
import { NewRecipeForm } from "../new-recipe-form";

export default async function NewRecipePage() {
  if (!BREWING_ENABLED) {
    notFound();
  }

  const { supabase } = await requireAdmin();

  const { data: existingPotions } = await supabase
    .from("items")
    .select("id, name")
    .eq("type", "potion")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New potion recipe</h2>
      <p className="text-sm text-stone-500">
        You&apos;ll be able to add ingredients (up to the brewing stand&apos;s 3 slots) after
        creating the recipe.
      </p>
      <NewRecipeForm existingPotions={existingPotions ?? []} />
    </div>
  );
}
