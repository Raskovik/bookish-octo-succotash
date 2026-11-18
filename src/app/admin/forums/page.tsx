import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ActiveBadge } from "@/components/admin/badges";
import type { ForumCategoryRow, ForumCategoryWithChildren } from "@/lib/supabase/types";

function groupByParent(categories: ForumCategoryRow[]): ForumCategoryWithChildren[] {
  const topLevel = categories.filter((c) => c.parent_id === null);
  return topLevel.map((parent) => ({
    ...parent,
    children: categories.filter((c) => c.parent_id === parent.id),
  }));
}

export default async function AdminForumsPage() {
  const { supabase } = await requireAdmin();

  const { data: categories } = await supabase
    .from("forum_categories")
    .select("id, parent_id, name, description, icon_url, sort_order, is_active, created_at")
    .order("sort_order")
    .order("name");

  const tree = groupByParent(categories ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Forum categories</h2>
        <Link
          href="/admin/forums/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New category
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Sort</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((category) => (
              <CategoryRows key={category.id} category={category} />
            ))}
            {tree.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-stone-500">
                  No forum categories yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryRows({ category }: { category: ForumCategoryWithChildren }) {
  return (
    <>
      <CategoryRow category={category} />
      {category.children.map((child) => (
        <CategoryRow key={child.id} category={child} indent />
      ))}
    </>
  );
}

function CategoryRow({ category, indent }: { category: ForumCategoryRow; indent?: boolean }) {
  return (
    <tr className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900">
      <td className="px-4 py-2">
        <Link
          href={`/admin/forums/${category.id}`}
          className={`flex items-center gap-2 hover:underline ${indent ? "pl-6" : ""}`}
        >
          {indent ? <span className="text-stone-400">↳</span> : null}
          {category.icon_url ? (
            <Image src={category.icon_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
          ) : null}
          {category.name}
        </Link>
      </td>
      <td className="px-4 py-2">{category.sort_order}</td>
      <td className="px-4 py-2">
        <ActiveBadge active={category.is_active} />
      </td>
    </tr>
  );
}
