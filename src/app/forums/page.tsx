import Image from "next/image";
import Link from "next/link";
import { Pin, Folders, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ForumPanel } from "@/components/forums/forum-panel";
import type { ForumCategoryRow } from "@/lib/supabase/types";

type CategoryWithChildren = ForumCategoryRow & { children: ForumCategoryRow[] };

function groupByParent(categories: ForumCategoryRow[]): CategoryWithChildren[] {
  const topLevel = categories.filter((c) => c.parent_id === null);
  return topLevel.map((parent) => ({
    ...parent,
    children: categories.filter((c) => c.parent_id === parent.id),
  }));
}

export default async function ForumsIndexPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("forum_categories")
    .select("id, parent_id, name, description, icon_url, sort_order, is_active, created_at")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  const tree = groupByParent(categories ?? []);
  // Every active category (top-level and subcategories alike) gets a
  // jump link — flattened, since "which forum" matters more here than
  // the hierarchy the main panel shows.
  const flatForJump = categories ?? [];

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-6 sm:flex-row sm:items-start">
      <aside className="w-full shrink-0 sm:w-60">
        <ForumPanel icon={<Pin size={18} />} title="Quick Jump">
          <nav className="flex flex-col gap-2 p-3">
            {flatForJump.map((category) => (
              <Link
                key={category.id}
                href={`/forums/${category.id}`}
                className="flex items-center gap-2 rounded-md bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-500"
              >
                {category.icon_url ? (
                  <Image
                    src={category.icon_url}
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] rounded-sm"
                  />
                ) : null}
                {category.name}
              </Link>
            ))}
            {flatForJump.length === 0 ? (
              <p className="px-2 py-1 text-sm text-stone-500">No categories yet.</p>
            ) : null}
          </nav>
        </ForumPanel>
      </aside>

      <div className="min-w-0 flex-1">
        <ForumPanel icon={<Folders size={18} />} title="Forum Index">
          <div>
            {tree.map((category) => (
              <div key={category.id}>
                <CategoryRow category={category} />
                {category.children.map((child) => (
                  <CategoryRow key={child.id} category={child} indent />
                ))}
              </div>
            ))}
            {tree.length === 0 ? (
              <p className="p-6 text-center text-stone-500">No forum categories yet — check back soon.</p>
            ) : null}
          </div>
        </ForumPanel>
      </div>
        </div>
      </div>
    </main>
  );
}

function CategoryRow({ category, indent }: { category: ForumCategoryRow; indent?: boolean }) {
  return (
    <Link
      href={`/forums/${category.id}`}
      className={`flex items-start gap-4 border-t border-green-100 p-5 first:border-t-0 hover:bg-green-50 ${indent ? "pl-12" : ""}`}
    >
      {category.icon_url ? (
        <Image src={category.icon_url} alt="" width={32} height={32} className="mt-0.5 h-8 w-8 rounded" />
      ) : (
        <MessageSquare size={24} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
      )}
      <div className="flex-1">
        <div className="text-base font-semibold text-green-900">{category.name}</div>
        {category.description ? <p className="mt-0.5 text-sm text-stone-500">{category.description}</p> : null}
      </div>
    </Link>
  );
}
