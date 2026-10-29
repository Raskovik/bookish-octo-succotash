"use client";

import { useActionState } from "react";
import { createForumThread, type ForumFormState } from "../../actions";
import { GardenBBCodeField } from "@/components/forums/garden-bbcode-field";

const initialState: ForumFormState = null;

export function NewThreadForm({ categoryId }: { categoryId: string }) {
  const [state, formAction, isPending] = useActionState(createForumThread, initialState);

  return (
    <form action={formAction} className="fm-form">
      <input type="hidden" name="category_id" value={categoryId} />

      <label>
        Title
        <input type="text" id="title" name="title" required maxLength={200} />
      </label>

      <GardenBBCodeField placeholder="Write your post..." />

      {state?.error ? <p className="fm-err">{state.error}</p> : null}

      <button type="submit" disabled={isPending} className="btn btn-sm btn-orange" style={{ alignSelf: "flex-start" }}>
        {isPending ? "Posting…" : "Start thread"}
      </button>
    </form>
  );
}
