import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ItemType, ItemWithQuantity } from "@/lib/supabase/types";

const TABS: { value: ItemType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ingredient", label: "Ingredients" },
  { value: "potion", label: "Potions" },
  { value: "cosmetic", label: "Cosmetics" },
];

function isItemType(value: string): value is ItemType {
  return value === "ingredient" || value === "potion" || value === "cosmetic";
}

// Read-only view of another player's inventory (0048_public_pet_and_
// item_viewing.sql made this visible at all) — same cards as the
// owner's own /items page, minus the for-trade toggle.
export default async function PlayerItemsPage(props: PageProps<"/u/[id]/items">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const typeParam = Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type;
  const activeTab = typeParam && isItemType(typeParam) ? typeParam : "all";

  const supabase = await createClient();

  const [{ data: profile }, { data: inventoryData }] = await Promise.all([
    supabase.from("user_profiles").select("id, display_name").eq("id", id).maybeSingle(),
    supabase
      .from("user_inventory")
      .select("quantity, item:items(id, name, image_url, rarity, type)")
      .eq("user_id", id)
      .gt("quantity", 0)
      .order("item_id", { ascending: true }),
  ]);

  const allItems = (inventoryData ?? []) as unknown as ItemWithQuantity[];
  const items = activeTab === "all" ? allItems : allItems.filter((entry) => entry.item?.type === activeTab);

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-6">
          <div>
            <Link href={`/u/${id}`} className="flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:underline">
              <ArrowLeft size={14} />
              Back to profile
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {profile?.display_name ?? "Player"}&apos;s items ({allItems.length})
            </h1>
          </div>

          <nav className="flex gap-2 border-b border-green-200 dark:border-stone-800">
            {TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tab.value === "all" ? `/u/${id}/items` : `/u/${id}/items?type=${tab.value}`}
                className={`border-b-2 px-3 py-2 text-sm ${
                  activeTab === tab.value
                    ? "border-green-800 font-medium dark:border-green-200"
                    : "border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {items.length === 0 ? (
            <p className="text-sm text-stone-500 italic">
              {allItems.length === 0 ? "No items yet." : "Nothing in this category yet."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {items.map((entry) =>
                entry.item ? (
                  <li
                    key={entry.item.id}
                    className="relative flex flex-col items-center gap-2 rounded-lg border border-green-200 p-3 text-center dark:border-stone-800"
                  >
                    <span className="absolute right-2 top-2 rounded-full bg-green-800 px-2 py-0.5 text-xs font-medium text-white dark:bg-green-200 dark:text-green-950">
                      ×{entry.quantity}
                    </span>
                    {entry.item.image_url ? (
                      <Image
                        src={entry.item.image_url}
                        alt={entry.item.name}
                        width={96}
                        height={96}
                        className="h-24 w-24 rounded"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded bg-green-200 dark:bg-stone-800" />
                    )}
                    <p className="text-sm font-medium">{entry.item.name}</p>
                    <p className="text-xs capitalize text-stone-500">
                      {entry.item.type} · {entry.item.rarity}
                    </p>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
