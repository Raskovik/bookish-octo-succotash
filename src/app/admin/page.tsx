import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();

  const [
    { count: zoneCount },
    { count: itemCount },
    { count: speciesCount },
    { count: recipeCount },
    { count: forumCategoryCount },
    { count: gardenPlantCount },
  ] = await Promise.all([
    supabase.from("zones").select("*", { count: "exact", head: true }),
    supabase.from("items").select("*", { count: "exact", head: true }),
    supabase.from("species").select("*", { count: "exact", head: true }),
    supabase.from("potion_recipes").select("*", { count: "exact", head: true }),
    supabase.from("forum_categories").select("*", { count: "exact", head: true }),
    supabase.from("garden_plants").select("*", { count: "exact", head: true }),
  ]);

  const cards = [
    { href: "/admin/zones", label: "Zones", count: zoneCount ?? 0 },
    { href: "/admin/items", label: "Items", count: itemCount ?? 0 },
    { href: "/admin/species", label: "Species", count: speciesCount ?? 0 },
    { href: "/admin/recipes", label: "Potion recipes", count: recipeCount ?? 0 },
    { href: "/admin/forums", label: "Forum categories", count: forumCategoryCount ?? 0 },
    { href: "/admin/garden-plants", label: "Garden plants", count: gardenPlantCount ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="flex flex-col gap-1 rounded-lg border border-green-200 p-4 hover:bg-green-100 dark:border-stone-800 dark:hover:bg-stone-900"
        >
          <span className="text-2xl font-semibold tracking-tight">{card.count}</span>
          <span className="text-sm text-stone-500">{card.label}</span>
        </Link>
      ))}
    </div>
  );
}
