import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { ForumPanel } from "@/components/forums/forum-panel";
import type { RecentForumThread } from "@/lib/supabase/types";

/**
 * The homepage's "Forum Activity" box — the most recently active
 * threads sitewide (ordered by last_post_at, same column the thread
 * list itself sorts by — see 0021_forums.sql). Presentational/props-
 * driven, same reasoning as SiteNewsPanel.
 */
export function ForumActivityPanel({ threads }: { threads: RecentForumThread[] }) {
  return (
    <ForumPanel icon={<MessagesSquare size={18} />} title="Forum Activity">
      {threads.length === 0 ? (
        <p className="p-5 text-sm italic text-stone-500">No forum activity yet.</p>
      ) : (
        <ul className="divide-y divide-green-200 dark:divide-stone-800">
          {threads.map((thread) => (
            <li key={thread.id} className="flex flex-col gap-1 p-4">
              <Link
                href={`/forums/${thread.category_id}/${thread.id}`}
                className="text-sm font-medium text-green-800 hover:underline dark:text-green-300"
              >
                {thread.title}
              </Link>
              <p className="text-xs text-stone-500">
                {thread.categoryName} · started by {thread.authorName} · {thread.reply_count}{" "}
                {thread.reply_count === 1 ? "reply" : "replies"}
              </p>
              <p className="text-xs text-stone-400">
                Last active {new Date(thread.last_post_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </ForumPanel>
  );
}
