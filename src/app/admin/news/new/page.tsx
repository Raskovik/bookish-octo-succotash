import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { NewsForm } from "../news-form";
import { createSiteNewsPost } from "../actions";

export default async function NewSiteNewsPage() {
  await requireAdmin();

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Admin</Link>
        <i>/</i>
        <Link href="/admin/news">Site news</Link>
        <i>/</i>
        <span>New</span>
      </div>
      <div className="ph">
        <h1>New news post</h1>
      </div>
      <NewsForm action={createSiteNewsPost} submitLabel="Post" />
    </>
  );
}
