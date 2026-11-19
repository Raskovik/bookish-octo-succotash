"use client";

import { useActionState, useState } from "react";
import type { ForumCategoryFormState } from "./actions";
import type { ForumCategoryRow } from "@/lib/supabase/types";

const initialState: ForumCategoryFormState = null;

export function CategoryForm({
  action,
  category,
  // Only top-level categories (parent_id null) are offered as parent
  // choices — that's what keeps the hierarchy exactly two levels deep
  // (see 0021_forums.sql's comment on this). When editing a top-level
  // category that already has subcategories, it's excluded from its own
  // list further down so it can't become a subcategory of itself.
  topLevelCategories,
  submitLabel,
}: {
  action: (prevState: ForumCategoryFormState, formData: FormData) => Promise<ForumCategoryFormState>;
  category?: ForumCategoryRow;
  topLevelCategories: Pick<ForumCategoryRow, "id" | "name">[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const parentOptions = topLevelCategories.filter((c) => c.id !== category?.id);

  return (
    <form action={formAction} className="card form">
      {category ? <input type="hidden" name="category_id" value={category.id} /> : null}

      <div className="fld">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={category?.name ?? ""} required maxLength={80} className="in" />
      </div>

      <div className="fld">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={category?.description ?? ""} maxLength={300} rows={3} className="in" />
      </div>

      <div className="fld">
        <label htmlFor="parent_id">Parent category</label>
        <select id="parent_id" name="parent_id" defaultValue={category?.parent_id ?? ""} className="in">
          <option value="">— Top-level category —</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="hint">Leave as top-level, or nest this under one of the existing top-level categories as a subcategory.</p>
      </div>

      <div className="fld">
        <span className="lbl">Icon</span>
        <div className="imgf">
          {previewUrl || category?.icon_url ? (
            <div className="th lg">
              {/* eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, which next/image can't optimize */}
              <img src={previewUrl ?? category!.icon_url!} alt="" />
            </div>
          ) : (
            <div className="th lg dash" />
          )}
          <div className="imgc">
            <input
              id="icon_file"
              name="icon_file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreviewUrl(file ? URL.createObjectURL(file) : null);
              }}
            />
            <p className="hint">PNG, JPEG, WebP, or GIF — up to 5 MB.</p>
          </div>
        </div>
        <label htmlFor="icon_url" className="hint" style={{ marginTop: 6, display: "block" }}>
          Or paste an image URL instead (used only if no file is uploaded above)
        </label>
        <input id="icon_url" name="icon_url" defaultValue={category?.icon_url ?? ""} placeholder="https://…" className="in" />
      </div>

      <div className="fld">
        <label htmlFor="sort_order">Sort order</label>
        <input id="sort_order" name="sort_order" type="number" defaultValue={category?.sort_order ?? 0} className="in num" />
        <p className="hint">Lower numbers are listed first.</p>
      </div>

      <div className="fld">
        <label className="chk">
          <input type="checkbox" name="is_active" defaultChecked={category?.is_active ?? true} />
          <span>
            <b>Active</b>
            <small>Visible on the forums, and can hold new threads</small>
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
