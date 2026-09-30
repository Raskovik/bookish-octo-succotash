"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type SiteNewsFormState = { error: string } | null;

function readSiteNewsFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (title.length === 0) return { ok: false as const, error: "Title can't be empty." };
  if (title.length > 200) return { ok: false as const, error: "Title must be 200 characters or fewer." };
  if (body.length === 0) return { ok: false as const, error: "Post body can't be empty." };
  if (body.length > 10000) return { ok: false as const, error: "Post body must be 10,000 characters or fewer." };

  return {
    ok: true as const,
    fields: { title, body, is_active: isActive },
  };
}

export async function createSiteNewsPost(
  _prevState: SiteNewsFormState,
  formData: FormData,
): Promise<SiteNewsFormState> {
  const { supabase, user } = await requireAdmin();

  const parsed = readSiteNewsFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase
    .from("site_news_posts")
    .insert({ ...parsed.fields, author_id: user.id });
  if (error) {
    return { error: `Could not post news: ${error.message}` };
  }

  revalidatePath("/admin/news");
  revalidatePath("/");
  redirect("/admin/news");
}

export async function updateSiteNewsPost(
  _prevState: SiteNewsFormState,
  formData: FormData,
): Promise<SiteNewsFormState> {
  const { supabase } = await requireAdmin();

  const postId = String(formData.get("post_id") ?? "");
  if (postId.length === 0) return { error: "Missing post id." };

  const parsed = readSiteNewsFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase
    .from("site_news_posts")
    .update({ ...parsed.fields, edited_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) {
    return { error: `Could not save news post: ${error.message}` };
  }

  revalidatePath("/admin/news");
  revalidatePath("/");
  redirect("/admin/news");
}
