import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BREWING_ENABLED } from "@/lib/feature-flags";
import { BrewingStand } from "@/components/brewing-stand";
import type {
  ActiveBrewSummary,
  ItemRarity,
  OwnedIngredient,
  RecipeIngredientWithStock,
  RecipeWithDetails,
} from "@/lib/supabase/types";

// Row shapes of the joined selects below. Hand-cast, like the other
// joined selects in this project — see the comment on PetWithSpecies in
// lib/supabase/types.ts.
type RecipeRow = {
  id: string;
  effect_type: RecipeWithDetails["effect_type"];
  effect_magnitude: number;
  is_active: boolean;
  potion: { id: string; name: string; image_url: string | null; rarity: ItemRarity } | null;
};
type IngredientRow = {
  recipe_id: string;
  quantity_required: number;
  item: { id: string; name: string; image_url: string | null; rarity: ItemRarity } | null;
};
type OwnedIngredientJoinRow = {
  item_id: string;
  quantity: number;
  items: { name: string; image_url: string | null; rarity: ItemRarity } | null;
};
type ActiveBrewJoinRow = {
  id: string;
  status: ActiveBrewSummary["status"];
  resolves_at: string;
  potion_recipes: { items: { name: string; image_url: string | null } | null } | null;
};

export default async function BrewingPage() {
  if (!BREWING_ENABLED) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Same lazy-resolution pattern as expeditions: settle anything whose
  // timer has already elapsed before reading current state.
  await supabase.rpc("resolve_due_brews", { p_user_id: user.id });

  const [
    { data: recipesData, error: recipesError },
    { data: ingredientsData, error: ingredientsError },
    { data: inventoryData },
    { data: ownedIngredientsData },
    { data: activeBrewData },
  ] = await Promise.all([
    supabase
      .from("potion_recipes")
      .select(
        "id, effect_type, effect_magnitude, is_active, potion:items!potion_recipes_output_potion_item_id_fkey(id, name, image_url, rarity)",
      )
      .eq("is_active", true),
    supabase
      .from("potion_recipe_ingredients")
      .select("recipe_id, quantity_required, item:items(id, name, image_url, rarity)"),
    supabase.from("user_inventory").select("item_id, quantity").eq("user_id", user.id),
    supabase
      .from("user_inventory")
      .select("item_id, quantity, items!inner(name, image_url, rarity, type)")
      .eq("user_id", user.id)
      .eq("items.type", "ingredient")
      .gt("quantity", 0),
    supabase
      .from("potion_brews")
      .select(
        "id, status, resolves_at, potion_recipes(items!potion_recipes_output_potion_item_id_fkey(name, image_url))",
      )
      .eq("user_id", user.id)
      .in("status", ["in_progress", "awaiting_claim"])
      .maybeSingle(),
  ]);

  const ownedQuantityByItem = new Map<string, number>();
  for (const row of inventoryData ?? []) {
    ownedQuantityByItem.set(row.item_id, row.quantity);
  }

  const ingredientsByRecipe = new Map<string, RecipeIngredientWithStock[]>();
  for (const row of (ingredientsData ?? []) as unknown as IngredientRow[]) {
    const list = ingredientsByRecipe.get(row.recipe_id) ?? [];
    list.push({
      item: row.item,
      quantityRequired: row.quantity_required,
      quantityOwned: row.item ? (ownedQuantityByItem.get(row.item.id) ?? 0) : 0,
    });
    ingredientsByRecipe.set(row.recipe_id, list);
  }

  const recipes: RecipeWithDetails[] = ((recipesData ?? []) as unknown as RecipeRow[]).map(
    (recipe) => {
      const ingredients = ingredientsByRecipe.get(recipe.id) ?? [];
      return {
        id: recipe.id,
        effect_type: recipe.effect_type,
        effect_magnitude: recipe.effect_magnitude,
        is_active: recipe.is_active,
        potion: recipe.potion,
        ingredients,
        canBrew:
          ingredients.length > 0 &&
          ingredients.every((ing) => ing.quantityOwned >= ing.quantityRequired),
      };
    },
  );

  const ownedIngredients: OwnedIngredient[] = (
    (ownedIngredientsData ?? []) as unknown as OwnedIngredientJoinRow[]
  )
    .filter((row) => row.items)
    .map((row) => ({
      itemId: row.item_id,
      name: row.items!.name,
      image_url: row.items!.image_url,
      rarity: row.items!.rarity,
      quantity: row.quantity,
    }));

  const activeBrewRow = activeBrewData as unknown as ActiveBrewJoinRow | null;
  const activeBrew: ActiveBrewSummary | null =
    activeBrewRow && activeBrewRow.potion_recipes?.items
      ? {
          id: activeBrewRow.id,
          status: activeBrewRow.status,
          resolves_at: activeBrewRow.resolves_at,
          potionName: activeBrewRow.potion_recipes.items.name,
          potionImageUrl: activeBrewRow.potion_recipes.items.image_url,
        }
      : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brewing</h1>
        <p className="text-sm text-stone-500">
          Place ingredients in the 3 slots below. If they match a recipe from the book, you can
          start brewing it — same recipe book for every player, nothing to unlock.
        </p>
      </div>
      {recipesError || ingredientsError ? (
        <div className="flex gap-2 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <Image src="/icons/exclamation.png" alt="" width={20} height={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Couldn&apos;t load the recipe book.</p>
            {recipesError ? (
              <p>
                potion_recipes ({recipesError.code}): {recipesError.message}
              </p>
            ) : null}
            {ingredientsError ? (
              <p>
                potion_recipe_ingredients ({ingredientsError.code}): {ingredientsError.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <BrewingStand recipes={recipes} ownedIngredients={ownedIngredients} activeBrew={activeBrew} />
    </main>
  );
}
