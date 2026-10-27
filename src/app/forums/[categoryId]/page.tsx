import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Folder, MessageSquare, Lock, Plus, Eye, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ForumPanel } from "@/components/forums/forum-panel";
import { PaginationBar } from "@/components/forums/pagination-bar";
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
          .select("id, name, icon_url")
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

  const newPostButton = (
    <Link
      href={`/forums/${category.id}/new`}
      className="flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-50"
    >
      <Plus size={16} />
      New Post
    </Link>
  );

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel flex flex-col gap-5">
      <div className="text-sm text-stone-500">
        <Link href="/forums" className="hover:underline">
          Forums
        </Link>
        {parent ? (
          <>
            {" / "}
            <Link href={`/forums/${parent.id}`} className="hover:underline">
              {parent.name}
            </Link>
          </>
        ) : null}
        {" / "}
        {category.name}
      </div>

      {children && children.length > 0 ? (
        <ForumPanel icon={<Folder size={18} />} title="Subcategories">
          <div>
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/forums/${child.id}`}
                className="flex items-center gap-3 border-t border-green-100 p-4 first:border-t-0 hover:bg-green-50"
              >
                {child.icon_url ? (
                  <Image src={child.icon_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                ) : (
                  <MessageSquare size={20} className="text-green-700" aria-hidden />
                )}
                <span className="text-base font-medium text-green-900">{child.name}</span>
              </Link>
            ))}
          </div>
        </ForumPanel>
      ) : null}

      {isDividerCategory ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-5 py-4 text-sm text-stone-500">
          {category.name} is organized into the subcategories above — pick one to see its threads.
        </p>
      ) : (
        <>
          <ForumPanel
            icon={<MessageSquare size={18} />}
            title={`${category.name} — Pinned Topics`}
            action={newPostButton}
          >
            {pinned.length > 0 ? (
              <ThreadTable categoryId={category.id} threads={pinned} />
            ) : (
              <p className="p-5 text-sm text-stone-500">No pinned topics.</p>
            )}
          </ForumPanel>

          <ForumPanel icon={<MessageSquare size={18} />} title={category.name}>
            {threads.length > 0 ? (
              <ThreadTable categoryId={category.id} threads={threads} />
            ) : (
              <p className="p-8 text-center text-stone-500">No threads yet — be the first to post!</p>
            )}
            <PaginationBar basePath={`/forums/${category.id}`} page={page} totalPages={totalPages} />
          </ForumPanel>
        </>
      )}
        </div>
      </div>
    </main>
  );
}

function ThreadTable({ categoryId, threads }: { categoryId: string; threads: ForumThreadListItem[] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {threads.map((thread) => (
          <tr key={thread.id} className="border-t border-green-100 first:border-t-0 hover:bg-green-50">
            <td className="w-12 px-5 py-4" aria-hidden>
              {thread.is_locked ? (
                <Lock size={20} className="text-stone-400" />
              ) : (
                <MessageSquare size={20} className="text-green-600" />
              )}
            </td>
            <td className="px-2 py-4">
              <Link href={`/forums/${categoryId}/${thread.id}`} className="text-base font-semibold hover:underline">
                {thread.title}
              </Link>
              <div className="mt-0.5 text-sm text-stone-500">
                Posted by{" "}
                <PlayerLink
                  userId={thread.authorId}
                  name={thread.authorName}
                  isAdmin={thread.authorIsAdmin}
                  isModerator={thread.authorIsModerator}
                  className="font-medium hover:underline"
                />{" "}
                » {formatForumDate(thread.created_at)}
              </div>
            </td>
            <td className="w-24 px-4 py-4 text-right text-xs text-stone-500">
              <div className="flex items-center justify-end gap-1 text-sm font-semibold text-stone-700">
                <Eye size={14} className="text-stone-400" />
                {thread.view_count}
              </div>
              Views
            </td>
            <td className="w-24 px-4 py-4 text-right text-xs text-stone-500">
              <div className="flex items-center justify-end gap-1 text-sm font-semibold text-stone-700">
                <MessageCircle size={14} className="text-stone-400" />
                {thread.reply_count}
              </div>
              Replies
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
