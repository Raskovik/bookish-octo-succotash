import { PlayerLink } from "@/components/player-link";
import { bbcodeToHtml } from "@/lib/bbcode";
import type { SiteNewsPostWithAuthor } from "@/lib/supabase/types";

/**
 * The homepage's "Site News" box. Presentational/props-driven (no data
 * fetching of its own) so it can be fed mock data for a visual check
 * without a live Supabase connection. body is raw BBCode, rendered the
 * same way pet/profile bios are — see the comment on SiteNewsPostRow.
 *
 * Markup matches furgarden-theme.css's .col/.frame-title/.post — its
 * own dedicated classes, not the shared ForumPanel component (used by
 * forums/messages/mod pages, which aren't converted to this theme and
 * shouldn't change just because this one page did).
 */
export function SiteNewsPanel({ posts }: { posts: SiteNewsPostWithAuthor[] }) {
  return (
    <section className="col" aria-labelledby="news-h">
      <h2 className="frame-title" id="news-h">
        <span className="sect-ico" />
        Site News
      </h2>
      <div className="frame-body">
        {posts.length === 0 ? (
          <p>No news posted yet.</p>
        ) : (
          posts.map((post) => (
            <article className="post" key={post.id}>
              <h3>{post.title}</h3>
              <p className="byline">
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
              <div className="forum-content" dangerouslySetInnerHTML={{ __html: bbcodeToHtml(post.body) }} />
            </article>
          ))
        )}
      </div>
    </section>
  );
}
