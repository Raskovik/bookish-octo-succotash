import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { NewsForm } from "../news-form";
import { updateSiteNewsPost } from "../actions";

export default async function EditSiteNewsPage(props: PageProps<"/admin/news/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: post } = await supabase
    .from("site_news_posts")
    .select("id, title, body, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!post) {
    notFound();
  }

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/news">Site news</Link>
        <i>/</i>
        <span>{post.title}</span>
      </div>
      <div className="ph">
        <h1>Edit news post</h1>
      </div>
      <NewsForm action={updateSiteNewsPost} post={post} submitLabel="Save changes" />
    </>
  );
}
