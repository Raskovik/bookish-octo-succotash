import Link from "next/link";
import type { RecentForumThread } from "@/lib/supabase/types";

/**
 * The homepage's "Forum Activity" box — the most recently active
 * threads sitewide (ordered by last_post_at, same column the thread
 * list itself sorts by — see 0021_forums.sql). Presentational/props-
 * driven, same reasoning as SiteNewsPanel.
 *
 * Matches furgarden-design/pages/home.html's .col.lime/.threads/.thread
 * — its own dedicated classes, not the shared ForumPanel component
 * (see the comment on SiteNewsPanel for why).
 */
export function ForumActivityPanel({ threads }: { threads: RecentForumThread[] }) {
  return (
    <aside className="col lime" aria-labelledby="forum-h">
      <h2 className="frame-title" id="forum-h">
        <span className="sect-ico ico-forum" />
        Forum Activity
      </h2>
      <div className="frame-body">
        {threads.length === 0 ? (
          <p>No forum activity yet.</p>
        ) : (
          <ul className="threads">
            {threads.map((thread) => (
              <li className="thread" key={thread.id}>
                <Link className="thread-title" href={`/forums/${thread.category_id}/${thread.id}`}>
                  {thread.title}
                </Link>
                <p className="thread-meta">
                  <span className="tag">{thread.categoryName}</span>
                  <b>
                    {thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}
                  </b>
                </p>
                <p className="thread-last">
                  Started by {thread.authorName} · Last active {new Date(thread.last_post_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
