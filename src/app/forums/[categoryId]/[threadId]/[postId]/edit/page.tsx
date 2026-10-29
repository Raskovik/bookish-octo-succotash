import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EditPostForm } from "./edit-post-form";

export default async function EditForumPostPage(
  props: PageProps<"/forums/[categoryId]/[threadId]/[postId]/edit">,
) {
  const { categoryId, threadId, postId } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: post } = await supabase
    .from("forum_posts")
    .select("id, thread_id, author_id, body_raw")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.thread_id !== threadId) {
    notFound();
  }

  const { data: profile } = await supabase.from("users").select("is_admin, is_moderator").eq("id", user.id).single();
  const canModerate = (profile?.is_admin || profile?.is_moderator) ?? false;
  if (post.author_id !== user.id && !canModerate) {
    // Matches the RLS policy exactly — "Authors and staff can edit a
    // post" (0028_moderation_round_two.sql) — so this is UX only; the
    // update itself is enforced again server-side regardless.
    redirect(`/forums/${categoryId}/${threadId}`);
  }

  return (
    <main id="main">
      <div className="sheet">
        <div className="panel forum">
          <nav className="fm-crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/forums">Forums</Link>
              </li>
              <li>
                <Link href={`/forums/${categoryId}/${threadId}`}>Back to thread</Link>
              </li>
              <li aria-current="page">Edit post</li>
            </ol>
          </nav>
          <section className="col" aria-labelledby="edit-h">
            <h2 className="frame-title" id="edit-h">
              <span className="sect-ico ico-forum" />
              Edit post
            </h2>
            <EditPostForm categoryId={categoryId} threadId={threadId} postId={post.id} defaultBody={post.body_raw} />
          </section>
        </div>
      </div>
    </main>
  );
}
