import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getObtainableIdSet } from "@/lib/admin-obtainable";
import { ItemsList } from "./items-list";

export default async function AdminItemsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: items }, obtainableIds] = await Promise.all([
    supabase.from("items").select("id, name, type, image_url, sell_value").order("name"),
    getObtainableIdSet(supabase, "item"),
  ]);

  const rows = (items ?? []).map((item) => ({ ...item, obtainable: obtainableIds.has(item.id) }));

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <span>Items</span>
      </div>
      <div className="ph">
        <h1>Items</h1>
        <div className="pha">
          <Link href="/admin/items/new" className="btn pri">
            + New item
          </Link>
        </div>
      </div>
      <p className="desc">Everything players can find, buy, sell and use.</p>

      <ItemsList rows={rows} />
    </>
  );
}
