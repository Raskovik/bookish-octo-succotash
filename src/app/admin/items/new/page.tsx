import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ItemForm } from "../item-form";
import { createItem } from "../actions";

export default async function NewItemPage() {
  await requireAdmin();

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/items">Items</Link>
        <i>/</i>
        <span>New</span>
      </div>
      <div className="ph">
        <h1>New item</h1>
      </div>
      <ItemForm action={createItem} isNew cancelHref="/admin/items" />
    </>
  );
}
