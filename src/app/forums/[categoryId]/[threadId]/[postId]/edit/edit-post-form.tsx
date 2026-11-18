"use client";

import { useActionState } from "react";
import { updateForumPost, type ForumFormState } from "../../../../actions";
import { GardenBBCodeField } from "@/components/forums/garden-bbcode-field";

const initialState: ForumFormState = null;

export function EditPostForm({
  categoryId,
  threadId,
  postId,
  defaultBody,
  defaultTitle,
}: {
  categoryId: string;
  threadId: string;
  postId: string;
  defaultBody: string;
  // Null when this isn't the thread's first post (or isn't your own) —
  // no title field shown at all in that case. See
  // rename_thread_for_first_post, 0079_edit_thread_title_and_auto_
  // delete_empty_threads.sql.
  defaultTitle: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateForumPost, initialState);

  return (
    <form action={formAction} className="fm-form">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="post_id" value={postId} />

      {defaultTitle !== null ? (
        <label>
          Thread title
          <input name="title" type="text" maxLength={200} required defaultValue={defaultTitle} />
        </label>
      ) : null}

      <GardenBBCodeField defaultValue={defaultBody} placeholder="Write your post..." />

      {state?.error ? <p className="fm-err">{state.error}</p> : null}

      <button type="submit" disabled={isPending} className="btn btn-sm btn-orange" style={{ alignSelf: "flex-start" }}>
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
