import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { BREWING_ENABLED } from "@/lib/feature-flags";
import type { PotionEffectType } from "@/lib/supabase/types";

// Hand-cast, like the other joined selects in this project — see the
// comment on PetWithSpecies in lib/supabase/types.ts.
type RecipeListRow = {
  id: string;
  effect_type: PotionEffectType;
  effect_magnitude: number;
  is_active: boolean;
  potion: { name: string; image_url: string | null } | null;
};

export default async function AdminRecipesPage() {
  if (!BREWING_ENABLED) {
    notFound();
  }

  const { supabase } = await requireAdmin();

  const { data: recipesData } = await supabase
    .from("potion_recipes")
    .select(
      "id, effect_type, effect_magnitude, is_active, potion:items!potion_recipes_output_potion_item_id_fkey(name, image_url)",
    )
    .order("created_at");

  const recipes = (recipesData ?? []) as unknown as RecipeListRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Potion recipes</h2>
        <Link
          href="/admin/recipes/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New recipe
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Potion</th>
              <th className="px-4 py-2">Effect</th>
              <th className="px-4 py-2">Magnitude</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe) => (
              <tr
                key={recipe.id}
                className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/admin/recipes/${recipe.id}`} className="flex items-center gap-2 hover:underline">
                    {recipe.potion?.image_url ? (
                      <Image
                        src={recipe.potion.image_url}
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded"
                      />
                    ) : null}
                    {recipe.potion?.name ?? "(deleted item)"}
                  </Link>
                </td>
                <td className="px-4 py-2">{recipe.effect_type.replace(/_/g, " ")}</td>
                <td className="px-4 py-2">{recipe.effect_magnitude}</td>
                <td className="px-4 py-2">{recipe.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {recipes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                  No recipes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
