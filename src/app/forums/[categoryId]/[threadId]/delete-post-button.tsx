"use client";

import { deletePost } from "../../actions";

/**
 * Only rendered for staff (see PostCard's canModerate) — that's UI
 * convenience, the real enforcement is forum_posts' staff-only DELETE
 * RLS policy (0027_moderation.sql). The confirm() is the one bit of
 * friction a plain "Remove" button elsewhere in this app doesn't need
 * (those are reversible or low-stakes); deleting someone else's post
 * isn't either.
 */
export function DeletePostButton({
  categoryId,
  threadId,
  postId,
}: {
  categoryId: string;
  threadId: string;
  postId: string;
}) {
  return (
    <form
      action={deletePost}
      onSubmit={(event) => {
        if (!confirm("Delete this post? This can't be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="post_id" value={postId} />
      <button type="submit" className="btn btn-sm btn-red fm-mod">
        Delete
      </button>
    </form>
  );
}
