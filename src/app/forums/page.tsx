import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

  // A category is a postable "forum" (vs. a pure divider) when it has no
  // children of its own — see 0023_forum_category_no_direct_posts.sql.
  // That's every child category, plus any top-level category that
  // happens to have none.
  const forums = tree.flatMap((cat) => (cat.children.length > 0 ? cat.children : [cat]));

  const forumIds = forums.map((f) => f.id);
  const { data: threadRows } =
    forumIds.length > 0
      ? await supabase.from("forum_threads").select("category_id, reply_count").in("category_id", forumIds)
      : { data: [] };

  const countsByForum = new Map<string, { topics: number; replies: number }>();
  for (const row of threadRows ?? []) {
    const current = countsByForum.get(row.category_id) ?? { topics: 0, replies: 0 };
    current.topics += 1;
    current.replies += row.reply_count;
    countsByForum.set(row.category_id, current);
  }

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel forum">
          <div className="shell">
            <section className="col lime" aria-labelledby="fi-h">
              <h2 className="frame-title" id="fi-h">
                <span className="sect-ico ico-forum" />
                Forum Index
              </h2>
              <div className="frame-body fm-flush">
                {tree.map((cat) => {
                  const rows = cat.children.length > 0 ? cat.children : [cat];
                  return (
                    <section className="fm-cat" aria-labelledby={`cat-${cat.id}`} key={cat.id}>
                      <h3 className="fm-cat-h" id={`cat-${cat.id}`}>
                        {cat.name}
                      </h3>
                      <ul className="fm-list">
                        {rows.map((forum) => {
                          const counts = countsByForum.get(forum.id) ?? { topics: 0, replies: 0 };
                          return (
                            <li className="fm-row" key={forum.id}>
                              <span className="tile t-orange i-chat" aria-hidden="true" />
                              <div className="fm-main">
                                <Link className="thread-title" href={`/forums/${forum.id}`}>
                                  {forum.name}
                                </Link>
                                {forum.description ? <p className="fm-sub">{forum.description}</p> : null}
                              </div>
                              <dl className="fm-counts">
                                <div>
                                  <dt>Topics</dt>
                                  <dd>{counts.topics}</dd>
                                </div>
                                <div>
                                  <dt>Replies</dt>
                                  <dd>{counts.replies}</dd>
                                </div>
                              </dl>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
                {tree.length === 0 ? <p style={{ padding: "18px" }}>No forum categories yet — check back soon.</p> : null}
              </div>
            </section>

            <aside className="col" aria-labelledby="qj-h">
              <h2 className="frame-title" id="qj-h">
                <span className="sect-ico fm-star" />
                Quick Jump
              </h2>
              <div className="frame-body">
                <ul className="fm-jump">
                  {forums.map((forum) => (
                    <li key={forum.id}>
                      <Link className="btn btn-sm btn-cream" href={`/forums/${forum.id}`}>
                        {forum.name}
                      </Link>
                    </li>
                  ))}
                  {forums.length === 0 ? <li>No forums yet.</li> : null}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
