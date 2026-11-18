import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getObtainableIdSet } from "@/lib/admin-obtainable";
import { ItemsList } from "./items-list";

export default async function AdminItemsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: items }, obtainableIds] = await Promise.all([
    supabase.from("items").select("id, name, type, rarity, image_url, sell_value").order("name"),
    getObtainableIdSet(supabase, "item"),
  ]);

  const rows = (items ?? []).map((item) => ({ ...item, obtainable: obtainableIds.has(item.id) }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Items</h2>
        <Link
          href="/admin/items/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New item
        </Link>
      </div>

      <ItemsList rows={rows} />
    </div>
  );
}
