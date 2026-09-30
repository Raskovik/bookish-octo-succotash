import { requireAdmin } from "@/lib/admin";
import { NewsForm } from "../news-form";
import { createSiteNewsPost } from "../actions";

export default async function NewSiteNewsPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">New news post</h2>
      <NewsForm action={createSiteNewsPost} submitLabel="Post" />
    </div>
  );
}
