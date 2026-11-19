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
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <span>Forums</span>
      </div>
      <div className="ph">
        <h1>Forum categories</h1>
        <div className="pha">
          <Link href="/admin/forums/new" className="btn pri">
            + New category
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Category</th>
                <th>Sort</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {tree.map((category) => (
                <CategoryRows key={category.id} category={category} />
              ))}
              {tree.length === 0 ? (
                <tr className="empty">
                  <td colSpan={3}>No forum categories yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
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
    <tr>
      <td>
        <Link href={`/admin/forums/${category.id}`} className="rl" style={indent ? { paddingLeft: 24 } : undefined}>
          {indent ? <span className="muted">↳</span> : null}
          {category.icon_url ? (
            <span className="th xs">
              <Image src={category.icon_url} alt="" width={26} height={26} />
            </span>
          ) : null}
          {category.name}
        </Link>
      </td>
      <td>{category.sort_order}</td>
      <td>
        <ActiveBadge active={category.is_active} />
      </td>
    </tr>
  );
}
