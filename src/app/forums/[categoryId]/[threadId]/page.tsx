import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MessageSquare, Pencil, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReplyForm } from "./reply-form";
import { ReplyToggle } from "./reply-toggle";
import { ThreadAdminControls } from "./thread-admin-controls";
import { DeletePostButton } from "./delete-post-button";
import { ForumPanel, ForumPanelSection } from "@/components/forums/forum-panel";
import { ReportButton } from "@/components/report-button";
import { PlayerLink } from "@/components/player-link";
import { PaginationBar } from "@/components/forums/pagination-bar";
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
    supabase.from("forum_categories").select("id, name").eq("id", categoryId).maybeSingle(),
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
        <div className="panel flex flex-col gap-5">
      <ForumPanel
        icon={thread.is_locked ? <Lock size={18} /> : <MessageSquare size={18} />}
        title={category ? `${category.name} > ${thread.title}` : thread.title}
        action={
          canModerate ? (
            <ThreadAdminControls
              categoryId={categoryId}
              threadId={thread.id}
              title={thread.title}
              isPinned={thread.is_pinned}
              isLocked={thread.is_locked}
            />
          ) : null
        }
      >
        <div>
          {postsWithAuthor.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              categoryId={categoryId}
              threadId={thread.id}
              canEdit={user?.id === post.authorId || canModerate}
              canModerate={canModerate}
              canReport={!!user && user.id !== post.authorId}
            />
          ))}
        </div>

        <PaginationBar basePath={`/forums/${categoryId}/${threadId}`} page={page} totalPages={totalPages} />
      </ForumPanel>

      {thread.is_locked ? (
        <p className="rounded-md border border-green-300 bg-green-50 px-5 py-4 text-sm text-stone-500">
          This thread is locked — no new replies.
        </p>
      ) : user ? (
        <ReplyToggle>
          <ForumPanelWrapper title={`Reply to ${thread.title}`}>
            <div className="p-5">
              <ReplyForm categoryId={categoryId} threadId={thread.id} />
            </div>
          </ForumPanelWrapper>
        </ReplyToggle>
      ) : (
        <p className="rounded-md border border-green-300 bg-green-50 px-5 py-4 text-sm">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to reply.
        </p>
      )}
        </div>
      </div>
    </main>
  );
}

function ForumPanelWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-green-300 shadow-sm">
      <ForumPanelSection title={title}>{children}</ForumPanelSection>
    </div>
  );
}

function PostCard({
  post,
  categoryId,
  threadId,
  canEdit,
  canModerate,
  canReport,
}: {
  post: ForumPostWithAuthor;
  categoryId: string;
  threadId: string;
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
    <article className="flex flex-col gap-4 border-t border-green-100 p-6 first:border-t-0 sm:flex-row">
      <div className="flex shrink-0 flex-row items-center gap-3 sm:w-32 sm:flex-col sm:text-center">
        {post.authorAvatarUrl ? (
          <Image
            src={post.authorAvatarUrl}
            alt=""
            width={72}
            height={72}
            className="h-16 w-16 rounded-md border-2 border-green-400 object-cover sm:h-[72px] sm:w-[72px]"
          />
        ) : (
          <div className="h-16 w-16 rounded-md border-2 border-dashed border-green-300 sm:h-[72px] sm:w-[72px]" />
        )}
        <PlayerLink
          userId={post.authorId}
          name={post.authorName}
          isAdmin={post.authorIsAdmin}
          isModerator={post.authorIsModerator}
          className="text-sm font-semibold hover:underline"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-stone-500">Posted {formatForumDate(post.created_at)}</div>
          <div className="flex shrink-0 gap-2">
            {canEdit ? (
              <Link
                href={`/forums/${categoryId}/${threadId}/${post.id}/edit`}
                className="flex items-center gap-1.5 rounded-md border border-green-300 px-2.5 py-1.5 text-xs font-medium hover:bg-green-50"
              >
                <Pencil size={14} />
                Edit
              </Link>
            ) : null}
            {canModerate ? (
              <DeletePostButton categoryId={categoryId} threadId={threadId} postId={post.id} />
            ) : null}
            {canReport ? (
              <ReportButton targetType="forum_post" targetId={post.id} offendingUserId={post.authorId} />
            ) : null}
          </div>
        </div>

        {post.is_hidden && !canModerate ? (
          <p className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-4 py-6 text-sm italic text-stone-500 dark:border-stone-800 dark:bg-stone-950">
            <EyeOff size={16} />
            This post is hidden pending moderator review.
          </p>
        ) : (
          <>
            {post.is_hidden ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                <span className="flex items-center gap-1.5">
                  <EyeOff size={14} />
                  Hidden pending review — only staff can see this post right now.
                </span>
                <form action={unhidePost}>
                  <input type="hidden" name="category_id" value={categoryId} />
                  <input type="hidden" name="thread_id" value={threadId} />
                  <input type="hidden" name="post_id" value={post.id} />
                  <button type="submit" className="font-semibold underline">
                    Unhide
                  </button>
                </form>
              </div>
            ) : null}
            {/* body_html is produced exclusively by bbcodeToHtml() at write
                time (src/lib/bbcode.ts) — this is the one place that
                rendered output is ever trusted enough to render. Never
                render body_raw directly. */}
            <div
              className="forum-content text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: post.body_html }}
            />
          </>
        )}

        {post.edit_count > 0 && post.edited_at ? (
          <p className="text-xs text-stone-400">
            Last edited by {editedByLabel} at {formatForumDate(post.edited_at)}. This post has been edited{" "}
            {post.edit_count} time{post.edit_count === 1 ? "" : "s"}.
          </p>
        ) : null}

        {canModerate && !post.is_hidden ? (
          <form action={testHidePost} className="self-start">
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="thread_id" value={threadId} />
            <input type="hidden" name="post_id" value={post.id} />
            <button
              type="submit"
              title="Manually hides this post as if 5 players had reported it — for visually testing the auto-hide feature"
              className="text-xs text-stone-400 underline hover:text-stone-600 dark:hover:text-stone-300"
            >
              Hide (test auto-hide-at-5-reports)
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}
