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
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {post ? <input type="hidden" name="post_id" value={post.id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={post?.title ?? ""}
          required
          maxLength={200}
          placeholder="What's the announcement?"
          className="rounded-md border border-green-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-sm font-medium">
          Post body
        </label>
        <BBCodeEditor name="body" defaultValue={post?.body ?? ""} rows={10} maxLength={10000} />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={post?.is_active ?? true}
          className="h-4 w-4 rounded border-green-300 dark:border-stone-700"
        />
        Active (visible on the homepage)
      </label>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
