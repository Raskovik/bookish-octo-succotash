"use client";

import { useActionState } from "react";
import { createForumReply, type ForumFormState } from "../../actions";
import { GardenBBCodeField } from "@/components/forums/garden-bbcode-field";

const initialState: ForumFormState = null;

export function ReplyForm({ categoryId, threadId }: { categoryId: string; threadId: string }) {
  const [state, formAction, isPending] = useActionState(createForumReply, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="thread_id" value={threadId} />

      <GardenBBCodeField placeholder="Write your reply..." />

      {state?.error ? <p className="fm-err">{state.error}</p> : null}

      <button type="submit" disabled={isPending} className="btn btn-sm btn-orange">
        {isPending ? "Posting…" : "Post Reply"}
      </button>
    </form>
  );
}
