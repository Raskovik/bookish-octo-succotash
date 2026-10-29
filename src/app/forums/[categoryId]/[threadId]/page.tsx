import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReplyForm } from "./reply-form";
import { ReplyToggle } from "./reply-toggle";
import { ThreadAdminControls } from "./thread-admin-controls";
import { DeletePostButton } from "./delete-post-button";
import { ReportButton } from "@/components/report-button";
import { PlayerLink } from "@/components/player-link";
import { FmPager } from "@/components/forums/fm-pager";
import { formatForumDate } from "@/lib/format-forum-date";
import { unhidePost, testHidePost } from "../../actions";
import type { ForumPostWithAuthor } from "@/lib/supabase/types";

const PAGE_SIZE = 10;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForumThreadPage(props: PageProps<"/forums/[categoryId]/[threadId]">) {
  const { categoryId, threadId } = await props.params;
  const searchParams = await props.searchParams;
  const pageParam = Number(first(searchParams.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id, category_id, title, is_pinned, is_locked, created_at")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.category_id !== categoryId) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: category }, { data: postsData, count }, profile] = await Promise.all([
    supabase.from("forum_categories").select("id, parent_id, name").eq("id", categoryId).maybeSingle(),
    supabase
      .from("forum_posts")
      .select(
        "id, author_id, body_raw, body_html, created_at, edited_at, edit_count, last_edited_by, is_hidden, hidden_at",
        { count: "exact" },
      )
      .eq("thread_id", thread.id)
      .order("created_at")
      .range(offset, offset + PAGE_SIZE - 1),
    user
      ? supabase.from("users").select("is_admin, is_moderator").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    // Best-effort view counter — not awaited-for-correctness, just fired
    // alongside the rest of this page's data so it doesn't add a round
    // trip. See increment_thread_view_count() (0022_forum_bbcode_and_views.sql).
    supabase.rpc("increment_thread_view_count", { p_thread_id: thread.id }),
  ]);

  const isAdmin = profile?.data?.is_admin ?? false;
  const canModerate = isAdmin || (profile?.data?.is_moderator ?? false);

  const { data: parentCategory } = category?.parent_id
    ? await supabase.from("forum_categories").select("id, name").eq("id", category.parent_id).maybeSingle()
    : { data: null };

  const posts = postsData ?? [];
  // last_edited_by is usually the same person as author_id, but not
  // always — staff can edit someone else's post — so it needs its own
  // profile (name + role) resolved too. Folded into the same lookup
  // rather than a second query.
  const profileIds = [
    ...new Set(posts.flatMap((p) => [p.author_id, p.last_edited_by].filter((id): id is string => id !== null))),
  ];
  const { data: profiles } =
    profileIds.length > 0
      ? await supabase
          .from("user_profiles")
          .select("id, display_name, avatar_url, is_admin, is_moderator")
          .in("id", profileIds)
      : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const postsWithAuthor: ForumPostWithAuthor[] = posts.map((p) => {
    const author = profileById.get(p.author_id);
    const editor = p.last_edited_by ? profileById.get(p.last_edited_by) : null;
    return {
      id: p.id,
      body_raw: p.body_raw,
      body_html: p.body_html,
      created_at: p.created_at,
      edited_at: p.edited_at,
      edit_count: p.edit_count,
      is_hidden: p.is_hidden,
      hidden_at: p.hidden_at,
      authorId: p.author_id,
      authorName: author?.display_name ?? "Unknown",
      authorAvatarUrl: author?.avatar_url ?? null,
      authorIsAdmin: author?.is_admin ?? false,
      authorIsModerator: author?.is_moderator ?? false,
      lastEditedById: p.last_edited_by,
      lastEditorName: p.last_edited_by ? (editor?.display_name ?? "Unknown") : null,
      lastEditorIsAdmin: editor?.is_admin ?? false,
      lastEditorIsModerator: editor?.is_moderator ?? false,
    };
  });

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
              {parentCategory ? (
                <li>
                  <Link href={`/forums/${parentCategory.id}`}>{parentCategory.name}</Link>
                </li>
              ) : null}
              {category ? (
                <li>
                  <Link href={`/forums/${categoryId}`}>{category.name}</Link>
                </li>
              ) : null}
              <li aria-current="page">
                {thread.title}
                {thread.is_locked ? " (Locked)" : ""}
              </li>
            </ol>
          </nav>

          <section className="col fm-block" aria-labelledby="th-h">
            <h2 className="frame-title" id="th-h">
              <span className="sect-ico ico-forum" />
              {thread.title}
              {canModerate ? (
                <ThreadAdminControls
                  categoryId={categoryId}
                  threadId={thread.id}
                  title={thread.title}
                  isPinned={thread.is_pinned}
                  isLocked={thread.is_locked}
                />
              ) : null}
            </h2>
            <div className="frame-body fm-flush">
              {postsWithAuthor.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  categoryId={categoryId}
                  threadId={thread.id}
                  isMine={user?.id === post.authorId}
                  canEdit={user?.id === post.authorId || canModerate}
                  canModerate={canModerate}
                  canReport={!!user && user.id !== post.authorId}
                />
              ))}
              <div className="fm-foot">
                <FmPager basePath={`/forums/${categoryId}/${threadId}`} page={page} totalPages={totalPages} />
              </div>
            </div>
          </section>

          {thread.is_locked ? (
            <p className="fm-sub" style={{ marginTop: "14px" }}>
              This thread is locked — no new replies.
            </p>
          ) : user ? (
            <ReplyToggle>
              <section className="col fm-block" aria-labelledby="reply-h" style={{ marginTop: "14px" }}>
                <h2 className="frame-title" id="reply-h">
                  <span className="sect-ico ico-forum" />
                  Reply to {thread.title}
                </h2>
                <div className="fm-form">
                  <ReplyForm categoryId={categoryId} threadId={thread.id} />
                </div>
              </section>
            </ReplyToggle>
          ) : (
            <p className="fm-sub" style={{ marginTop: "14px" }}>
              <Link href="/login">Sign in</Link> to reply.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function PostCard({
  post,
  categoryId,
  threadId,
  isMine,
  canEdit,
  canModerate,
  canReport,
}: {
  post: ForumPostWithAuthor;
  categoryId: string;
  threadId: string;
  isMine: boolean;
  canEdit: boolean;
  canModerate: boolean;
  canReport: boolean;
}) {
  // The real name is shown only when the editor IS the author (a normal
  // self-edit) or isn't staff — a staff member editing someone else's
  // post shows a generic role label instead, per the explicit ask not to
  // expose which specific mod/admin touched another player's content.
  const editedBySomeoneElse = post.lastEditedById !== null && post.lastEditedById !== post.authorId;
  const editedByLabel =
    editedBySomeoneElse && post.lastEditorIsAdmin
      ? "an admin"
      : editedBySomeoneElse && post.lastEditorIsModerator
        ? "a moderator"
        : (post.lastEditorName ?? "Unknown");

  return (
    <article className={`fm-post${isMine ? " fm-mine" : ""}`}>
      <div className="fm-author">
        <Link href={`/u/${post.authorId}`}>
          <div
            className="av-sq"
            role="img"
            aria-label={`${post.authorName}'s avatar`}
            style={post.authorAvatarUrl ? { backgroundImage: `url(${post.authorAvatarUrl})` } : undefined}
          />
        </Link>
        <PlayerLink
          userId={post.authorId}
          name={post.authorName}
          isAdmin={post.authorIsAdmin}
          isModerator={post.authorIsModerator}
          className="fm-name"
        />
      </div>
      <div className="fm-content">
        <header className="fm-phead">
          <p className="byline">
            Posted <time>{formatForumDate(post.created_at)}</time>
          </p>
          <div className="fm-acts">
            {canEdit ? (
              <Link className="btn btn-sm btn-cream" href={`/forums/${categoryId}/${threadId}/${post.id}/edit`}>
                Edit
              </Link>
            ) : null}
            {canReport ? (
              <ReportButton
                targetType="forum_post"
                targetId={post.id}
                offendingUserId={post.authorId}
                triggerClassName="btn btn-sm btn-red"
              />
            ) : null}
            {canModerate ? <DeletePostButton categoryId={categoryId} threadId={threadId} postId={post.id} /> : null}
          </div>
        </header>

        {post.is_hidden && !canModerate ? (
          <p className="fm-sub">This post is hidden pending moderator review.</p>
        ) : (
          <>
            {post.is_hidden ? (
              <p className="fm-sub">
                Hidden pending review — only staff can see this post right now.{" "}
                <form action={unhidePost} style={{ display: "inline" }}>
                  <input type="hidden" name="category_id" value={categoryId} />
                  <input type="hidden" name="thread_id" value={threadId} />
                  <input type="hidden" name="post_id" value={post.id} />
                  <button type="submit" className="btn btn-sm btn-cream">
                    Unhide
                  </button>
                </form>
              </p>
            ) : null}
            {/* body_html is produced exclusively by bbcodeToHtml() at write
                time (src/lib/bbcode.ts) — this is the one place that
                rendered output is ever trusted enough to render. Never
                render body_raw directly. */}
            <div className="bbcode" dangerouslySetInnerHTML={{ __html: post.body_html }} />
          </>
        )}

        {post.edit_count > 0 && post.edited_at ? (
          <p className="fm-sub">
            Last edited by {editedByLabel} at {formatForumDate(post.edited_at)}. This post has been edited{" "}
            {post.edit_count} time{post.edit_count === 1 ? "" : "s"}.
          </p>
        ) : null}

        {canModerate && !post.is_hidden ? (
          <form action={testHidePost}>
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="thread_id" value={threadId} />
            <input type="hidden" name="post_id" value={post.id} />
            <button
              type="submit"
              className="btn btn-sm btn-cream fm-mod"
              title="Manually hides this post as if 5 players had reported it — for visually testing the auto-hide feature"
            >
              Hide (test)
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}
