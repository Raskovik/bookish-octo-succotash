"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bbcodeToHtml } from "@/lib/bbcode";

export type ForumFormState = { error: string } | null;

// Shared by new-thread and reply forms — the raw body coming out of
// BBCodeEditor's textarea is untrusted whether a toolbar button or
// hand-typed tags produced it. bbcodeToHtml() is the only thing that
// turns it into something safe to store as body_html and later render
// with dangerouslySetInnerHTML.
function readAndRenderBody(formData: FormData): { ok: true; raw: string; html: string } | { ok: false; error: string } {
  const raw = String(formData.get("body") ?? "");
  if (raw.trim().length === 0) {
    return { ok: false, error: "Post can't be empty." };
  }
  if (raw.length > 20000) {
    return { ok: false, error: "Post is too long (20,000 character limit)." };
  }

  const html = bbcodeToHtml(raw);
  if (html.trim().length === 0) {
    return { ok: false, error: "That post didn't contain any content once cleaned up — try adding some text." };
  }

  return { ok: true, raw, html };
}

export async function createForumThread(
  _prevState: ForumFormState,
  formData: FormData,
): Promise<ForumFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (categoryId.length === 0) return { error: "Missing category." };
  if (title.length === 0) return { error: "Title can't be empty." };
  if (title.length > 200) return { error: "Title must be 200 characters or fewer." };

  // Friendly pre-check — forum_threads' INSERT policy (0029_bans_and_
  // staff_fixes.sql) is the real backstop, this just turns a rejected
  // insert into a readable message.
  const { data: isForumsBanned } = await supabase.rpc("user_has_active_ban", {
    p_user_id: user.id,
    p_ban_type: "forums",
  });
  if (isForumsBanned) {
    return { error: "You're currently banned from posting to the forums." };
  }

  // Parent categories with subcategories are pure dividers, not postable
  // — see 0023_forum_category_no_direct_posts.sql, which enforces this
  // same rule at the RLS layer as the real backstop. This check just
  // turns that into a friendly message instead of a raw RLS error.
  const { count: childCount } = await supabase
    .from("forum_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", categoryId);
  if ((childCount ?? 0) > 0) {
    return { error: "You can't post directly in a parent category — pick a subcategory instead." };
  }

  const body = readAndRenderBody(formData);
  if (!body.ok) return { error: body.error };

  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .insert({ category_id: categoryId, author_id: user.id, title })
    .select("id")
    .single();
  if (threadError || !thread) {
    return { error: `Could not start thread: ${threadError?.message ?? "unknown error"}` };
  }

  const { error: postError } = await supabase.from("forum_posts").insert({
    thread_id: thread.id,
    author_id: user.id,
    body_raw: body.raw,
    body_html: body.html,
  });
  if (postError) {
    // A thread with no posts at all would be a dead, empty listing —
    // roll it back rather than leave an orphan behind. Most likely
    // cause now is the content filter (0077_content_filter.sql)
    // rejecting the post body even though the title passed.
    await supabase.from("forum_threads").delete().eq("id", thread.id);
    return { error: postError.message };
  }

  revalidatePath(`/forums/${categoryId}`);
  redirect(`/forums/${categoryId}/${thread.id}`);
}

export async function createForumReply(
  _prevState: ForumFormState,
  formData: FormData,
): Promise<ForumFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const threadId = String(formData.get("thread_id") ?? "");
  if (categoryId.length === 0 || threadId.length === 0) return { error: "Missing thread." };

  const { data: isForumsBanned } = await supabase.rpc("user_has_active_ban", {
    p_user_id: user.id,
    p_ban_type: "forums",
  });
  if (isForumsBanned) {
    return { error: "You're currently banned from posting to the forums." };
  }

  const body = readAndRenderBody(formData);
  if (!body.ok) return { error: body.error };

  const { error } = await supabase.from("forum_posts").insert({
    thread_id: threadId,
    author_id: user.id,
    body_raw: body.raw,
    body_html: body.html,
  });
  if (error) {
    return { error: `Could not post your reply: ${error.message}` };
  }

  revalidatePath(`/forums/${categoryId}/${threadId}`);
  redirect(`/forums/${categoryId}/${threadId}`);
}

export async function updateForumPost(
  _prevState: ForumFormState,
  formData: FormData,
): Promise<ForumFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const threadId = String(formData.get("thread_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (categoryId.length === 0 || threadId.length === 0 || postId.length === 0) {
    return { error: "Missing post." };
  }

  const body = readAndRenderBody(formData);
  if (!body.ok) return { error: body.error };

  // No .select() row back means RLS silently filtered the update out —
  // "Authors and admins can edit a post" (0021_forums.sql) is the real
  // gate here; this just turns that into a readable message instead of
  // a redirect that looks like it worked. edited_at/edit_count/
  // last_edited_by are all set by the track_forum_post_edit() trigger
  // (0024_forum_post_edit_tracking.sql), not here.
  const { data, error } = await supabase
    .from("forum_posts")
    .update({ body_raw: body.raw, body_html: body.html })
    .eq("id", postId)
    .select("id");
  if (error) {
    return { error: `Could not save your edit: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { error: "You can only edit your own posts." };
  }

  revalidatePath(`/forums/${categoryId}/${threadId}`);
  redirect(`/forums/${categoryId}/${threadId}`);
}

// Pin/lock/title are staff (moderator or admin) actions. The button that
// submits this form is only rendered for staff (see ThreadAdminControls),
// but that's just UI convenience — the real enforcement is forum_threads'
// staff-only UPDATE RLS policy (0027_moderation.sql, widened from
// admin-only in 0021_forums.sql), which rejects this write outright for
// anyone else regardless of what the client sends. Title is optional in
// the form data (blank/missing means "don't touch it") so this one action
// can serve both the original pin/lock checkboxes and the newer title
// field without every caller needing to resend a title.
export async function updateThreadFlags(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const threadId = String(formData.get("thread_id") ?? "");
  if (categoryId.length === 0 || threadId.length === 0) return;

  const title = String(formData.get("title") ?? "").trim();

  const update: { is_pinned: boolean; is_locked: boolean; title?: string } = {
    is_pinned: formData.get("is_pinned") === "on",
    is_locked: formData.get("is_locked") === "on",
  };
  if (title.length > 0 && title.length <= 200) {
    update.title = title;
  }

  await supabase.from("forum_threads").update(update).eq("id", threadId);

  revalidatePath(`/forums/${categoryId}/${threadId}`);
  redirect(`/forums/${categoryId}/${threadId}`);
}

// Deletion is a staff-only action — same reliance-on-RLS-alone as
// updateThreadFlags above (forum_posts' staff-only DELETE policy,
// 0027_moderation.sql). sync_forum_thread_stats keeps reply_count/
// last_post_at correct on delete too, so nothing here needs to touch
// forum_threads directly.
export async function deletePost(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const threadId = String(formData.get("thread_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (categoryId.length === 0 || threadId.length === 0 || postId.length === 0) return;

  await supabase.from("forum_posts").delete().eq("id", postId);

  revalidatePath(`/forums/${categoryId}/${threadId}`);
  redirect(`/forums/${categoryId}/${threadId}`);
}

// Deleting a thread cascades to its posts (forum_posts.thread_id has
// on delete cascade — 0021_forums.sql) — staff-only, same as above.
export async function deleteThread(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const threadId = String(formData.get("thread_id") ?? "");
  if (categoryId.length === 0 || threadId.length === 0) return;

  await supabase.from("forum_threads").delete().eq("id", threadId);

  revalidatePath(`/forums/${categoryId}`);
  redirect(`/forums/${categoryId}`);
}

// Un-hides a post — staff-only via forum_posts' staff-or-author UPDATE
// policy (0028_moderation_round_two.sql), same reliance-on-RLS-alone as
// every other staff action in this file.
export async function unhidePost(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = String(formData.get("category_id") ?? "");
  const threadId = String(formData.get("thread_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (categoryId.length === 0 || threadId.length === 0 || postId.length === 0) return;

  await supabase.from("forum_posts").update({ is_hidden: false, hidden_at: null }).eq("id", postId);

  revalidatePath(`/forums/${categoryId}/${threadId}`);
}
