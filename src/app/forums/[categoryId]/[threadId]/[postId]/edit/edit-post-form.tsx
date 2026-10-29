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
}: {
  categoryId: string;
  threadId: string;
  postId: string;
  defaultBody: string;
}) {
  const [state, formAction, isPending] = useActionState(updateForumPost, initialState);

  return (
    <form action={formAction} className="fm-form">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="post_id" value={postId} />

      <GardenBBCodeField defaultValue={defaultBody} placeholder="Write your post..." />

      {state?.error ? <p className="fm-err">{state.error}</p> : null}

      <button type="submit" disabled={isPending} className="btn btn-sm btn-orange" style={{ alignSelf: "flex-start" }}>
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
