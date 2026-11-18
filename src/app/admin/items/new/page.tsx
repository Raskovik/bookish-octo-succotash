import { requireAdmin } from "@/lib/admin";
import { ItemForm } from "../item-form";
import { createItem } from "../actions";

export default async function NewItemPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New item</h2>
      <ItemForm action={createItem} isNew cancelHref="/admin/items" />
    </div>
  );
}
