import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ActiveBadge } from "@/components/admin/badges";

export default async function AdminNewsPage() {
  const { supabase } = await requireAdmin();

  const { data: posts } = await supabase
    .from("site_news_posts")
    .select("id, title, is_active, created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <span>Site news</span>
      </div>
      <div className="ph">
        <h1>Site news</h1>
        <div className="pha">
          <Link href="/admin/news/new" className="btn pri">
            + New post
          </Link>
        </div>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>Shown on the homepage, most recent first — see /.</p>

      <div className="card">
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Title</th>
                <th>Posted</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {(posts ?? []).map((post) => (
                <tr key={post.id}>
                  <td>
                    <Link href={`/admin/news/${post.id}`} className="rl">
                      {post.title}
                    </Link>
                  </td>
                  <td className="muted">{new Date(post.created_at).toLocaleDateString()}</td>
                  <td>
                    <ActiveBadge active={post.is_active} />
                  </td>
                </tr>
              ))}
              {(posts ?? []).length === 0 ? (
                <tr className="empty">
                  <td colSpan={3}>No news posts yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
