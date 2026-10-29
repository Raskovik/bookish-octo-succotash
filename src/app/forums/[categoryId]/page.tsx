import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FmPager } from "@/components/forums/fm-pager";
import { PlayerLink } from "@/components/player-link";
import { formatForumDate } from "@/lib/format-forum-date";
import type { ForumThreadListItem } from "@/lib/supabase/types";

const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForumCategoryPage(props: PageProps<"/forums/[categoryId]">) {
  const { categoryId } = await props.params;
  const searchParams = await props.searchParams;
  const pageParam = Number(first(searchParams.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("forum_categories")
    .select("id, parent_id, name, description, icon_url, is_active")
    .eq("id", categoryId)
    .maybeSingle();

  if (!category || !category.is_active) {
    notFound();
  }

  const [{ data: parent }, { data: children }] = await Promise.all([
    category.parent_id
      ? supabase.from("forum_categories").select("id, name").eq("id", category.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    category.parent_id === null
      ? supabase
          .from("forum_categories")
          .select("id, name, description")
          .eq("parent_id", category.id)
          .eq("is_active", true)
          .order("sort_order")
      : Promise.resolve({ data: null }),
  ]);

  // Parent categories with subcategories are pure dividers — a visual
  // way to group forums, not a place threads can live (see
  // 0023_forum_category_no_direct_posts.sql, which enforces this same
  // rule at the RLS layer as the real backstop). So a page like this
  // never shows a thread list or "New Post" button; it's just the
  // subcategory list below.
  const isDividerCategory = category.parent_id === null && (children?.length ?? 0) > 0;

  const [{ data: pinnedData }, { data: threadsData, count }] = isDividerCategory
    ? [{ data: [] }, { data: [], count: 0 }]
    : await Promise.all([
        supabase
          .from("forum_threads")
          .select(
            "id, title, is_pinned, is_locked, reply_count, view_count, created_at, last_post_at, author_id",
          )
          .eq("category_id", category.id)
          .eq("is_pinned", true)
          .order("last_post_at", { ascending: false }),
        supabase
          .from("forum_threads")
          .select(
            "id, title, is_pinned, is_locked, reply_count, view_count, created_at, last_post_at, author_id",
            { count: "exact" },
          )
          .eq("category_id", category.id)
          .eq("is_pinned", false)
          .order("last_post_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1),
      ]);

  const pinnedRows = pinnedData ?? [];
  const threadRows = threadsData ?? [];
  const authorIds = [...new Set([...pinnedRows, ...threadRows].map((t) => t.author_id))];
  const { data: profiles } =
    authorIds.length > 0
      ? await supabase.from("user_profiles").select("id, display_name, is_admin, is_moderator").in("id", authorIds)
      : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  function toListItem(t: (typeof threadRows)[number]): ForumThreadListItem {
    const author = profileById.get(t.author_id);
    return {
      id: t.id,
      title: t.title,
      is_pinned: t.is_pinned,
      is_locked: t.is_locked,
      reply_count: t.reply_count,
      view_count: t.view_count,
      created_at: t.created_at,
      last_post_at: t.last_post_at,
      authorId: t.author_id,
      authorName: author?.display_name ?? "Unknown",
      authorIsAdmin: author?.is_admin ?? false,
      authorIsModerator: author?.is_moderator ?? false,
    };
  }

  const pinned = pinnedRows.map(toListItem);
  const threads = threadRows.map(toListItem);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel forum">
          <nav className="fm-crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/forums">Forums</Link>
              </li>
              {parent ? (
                <li>
                  <Link href={`/forums/${parent.id}`}>{parent.name}</Link>
                </li>
              ) : null}
              <li aria-current="page">{category.name}</li>
            </ol>
          </nav>

          {isDividerCategory ? (
            <section className="col fm-block" aria-labelledby="sub-h">
              <h2 className="frame-title" id="sub-h">
                <span className="sect-ico ico-forum" />
                {category.name}
              </h2>
              <div className="frame-body fm-flush">
                <ul className="fm-list">
                  {(children ?? []).map((child) => (
                    <li className="fm-row" key={child.id}>
                      <span className="tile t-orange i-chat" aria-hidden="true" />
                      <div className="fm-main">
                        <Link className="thread-title" href={`/forums/${child.id}`}>
                          {child.name}
                        </Link>
                        {child.description ? <p className="fm-sub">{child.description}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <>
              {pinned.length > 0 ? (
                <section className="col lime fm-block" aria-labelledby="pin-h">
                  <h2 className="frame-title" id="pin-h">
                    <span className="sect-ico fm-star" />
                    Pinned Topics
                  </h2>
                  <div className="frame-body fm-flush">
                    <ul className="fm-list">
                      {pinned.map((thread) => (
                        <ThreadRow key={thread.id} categoryId={category.id} thread={thread} pinned />
                      ))}
                    </ul>
                  </div>
                </section>
              ) : null}

              <section className="col fm-block" aria-labelledby="tp-h">
                <h2 className="frame-title" id="tp-h">
                  <span className="sect-ico ico-forum" />
                  {category.name}
                  <Link className="btn btn-sm btn-orange fm-new" href={`/forums/${category.id}/new`}>
                    + New Post
                  </Link>
                </h2>
                <div className="frame-body fm-flush">
                  <ul className="fm-list">
                    {threads.map((thread) => (
                      <ThreadRow key={thread.id} categoryId={category.id} thread={thread} pinned={false} />
                    ))}
                    {threads.length === 0 ? <li style={{ padding: "18px" }}>No threads yet — be the first to post!</li> : null}
                  </ul>
                  <div className="fm-foot">
                    <FmPager basePath={`/forums/${category.id}`} page={page} totalPages={totalPages} />
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function ThreadRow({
  categoryId,
  thread,
  pinned,
}: {
  categoryId: string;
  thread: ForumThreadListItem;
  pinned: boolean;
}) {
  return (
    <li className="fm-row">
      <span className={`tile ${pinned ? "t-gold i-star" : "i-chat"}`} aria-hidden="true" />
      <div className="fm-main">
        <Link className="thread-title" href={`/forums/${categoryId}/${thread.id}`}>
          {thread.title}
          {thread.is_locked ? " (Locked)" : ""}
        </Link>
        <p className="fm-sub">
          Posted by{" "}
          <PlayerLink
            userId={thread.authorId}
            name={thread.authorName}
            isAdmin={thread.authorIsAdmin}
            isModerator={thread.authorIsModerator}
          />{" "}
          » <time>{formatForumDate(thread.created_at)}</time>
        </p>
      </div>
      <dl className="fm-counts">
        <div>
          <dt>Views</dt>
          <dd>{thread.view_count}</dd>
        </div>
        <div>
          <dt>Replies</dt>
          <dd>{thread.reply_count}</dd>
        </div>
      </dl>
    </li>
  );
}
