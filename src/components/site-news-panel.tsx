import { Megaphone } from "lucide-react";
import { ForumPanel } from "@/components/forums/forum-panel";
import { PlayerLink } from "@/components/player-link";
import { bbcodeToHtml } from "@/lib/bbcode";
import type { SiteNewsPostWithAuthor } from "@/lib/supabase/types";

/**
 * The homepage's "Site News" box — admin-authored posts, most recent
 * first. Presentational/props-driven (no data fetching of its own) so
 * it can be fed mock data for a visual check without a live Supabase
 * connection. body is raw BBCode, rendered the same way pet/profile
 * bios are — see the comment on SiteNewsPostRow.
 */
export function SiteNewsPanel({ posts }: { posts: SiteNewsPostWithAuthor[] }) {
  return (
    <ForumPanel icon={<Megaphone size={18} />} title="Site News">
      {posts.length === 0 ? (
        <p className="p-5 text-sm italic text-stone-500">No news posted yet.</p>
      ) : (
        <ul className="divide-y divide-green-200 dark:divide-stone-800">
          {posts.map((post) => (
            <li key={post.id} className="flex flex-col gap-1.5 p-5">
              <h3 className="text-base font-semibold tracking-tight">{post.title}</h3>
              <p className="text-xs text-stone-500">
                Posted by{" "}
                <PlayerLink
                  userId={post.author_id}
                  name={post.authorName}
                  isAdmin={post.authorIsAdmin}
                  isModerator={post.authorIsModerator}
                />{" "}
                on {new Date(post.created_at).toLocaleDateString()}
                {post.edited_at ? " (edited)" : ""}
              </p>
              <div
                className="forum-content text-sm text-stone-700 dark:text-stone-300"
                dangerouslySetInnerHTML={{ __html: bbcodeToHtml(post.body) }}
              />
            </li>
          ))}
        </ul>
      )}
    </ForumPanel>
  );
}
