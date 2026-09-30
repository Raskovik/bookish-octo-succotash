import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminNewsPage() {
  const { supabase } = await requireAdmin();

  const { data: posts } = await supabase
    .from("site_news_posts")
    .select("id, title, is_active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Site news</h2>
          <p className="text-sm text-stone-500">
            Shown on the homepage, most recent first — see /.
          </p>
        </div>
        <Link
          href="/admin/news/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New post
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Posted</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(posts ?? []).map((post) => (
              <tr
                key={post.id}
                className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/admin/news/${post.id}`} className="hover:underline">
                    {post.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-stone-500">
                  {new Date(post.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">{post.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(posts ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-stone-500">
                  No news posts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
