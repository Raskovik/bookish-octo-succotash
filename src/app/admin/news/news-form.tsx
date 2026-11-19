"use client";

import { useActionState } from "react";
import { BBCodeEditor } from "@/components/forums/bbcode-editor";
import type { SiteNewsFormState } from "./actions";
import type { SiteNewsPostRow } from "@/lib/supabase/types";

const initialState: SiteNewsFormState = null;

export function NewsForm({
  action,
  post,
  submitLabel,
}: {
  action: (prevState: SiteNewsFormState, formData: FormData) => Promise<SiteNewsFormState>;
  post?: Pick<SiteNewsPostRow, "id" | "title" | "body" | "is_active">;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="card form">
      {post ? <input type="hidden" name="post_id" value={post.id} /> : null}

      <div className="fld">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          defaultValue={post?.title ?? ""}
          required
          maxLength={200}
          placeholder="What's the announcement?"
          className="in"
        />
      </div>

      <div className="fld">
        <label htmlFor="body">Post body</label>
        <BBCodeEditor name="body" defaultValue={post?.body ?? ""} rows={10} maxLength={10000} />
      </div>

      <div className="fld">
        <label className="chk">
          <input type="checkbox" name="is_active" defaultChecked={post?.is_active ?? true} />
          <span>
            <b>Active</b>
            <small>Visible on the homepage</small>
          </span>
        </label>
      </div>

      {state?.error ? <p className="err">{state.error}</p> : null}

      <button type="submit" disabled={isPending} className="btn pri" style={{ marginTop: 14 }}>
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
