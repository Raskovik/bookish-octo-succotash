import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { CategoryForm } from "../category-form";
import { createForumCategory } from "../actions";

export default async function NewForumCategoryPage() {
  const { supabase } = await requireAdmin();

  const { data: topLevelCategories } = await supabase
    .from("forum_categories")
    .select("id, name")
    .is("parent_id", null)
    .order("name");

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/forums">Forums</Link>
        <i>/</i>
        <span>New</span>
      </div>
      <div className="ph">
        <h1>New forum category</h1>
      </div>
      <CategoryForm action={createForumCategory} topLevelCategories={topLevelCategories ?? []} submitLabel="Create category" />
    </>
  );
}
