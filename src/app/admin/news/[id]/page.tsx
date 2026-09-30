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
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Edit news post</h2>
      <NewsForm action={updateSiteNewsPost} post={post} submitLabel="Save changes" />
    </div>
  );
}
