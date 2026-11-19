import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ActiveBadge } from "@/components/admin/badges";

export default async function AdminCannedMessagesPage() {
  const { supabase } = await requireAdmin();

  const { data: messages } = await supabase
    .from("canned_staff_messages")
    .select("id, label, is_active, sort_order")
    .order("sort_order");

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <span>Canned messages</span>
      </div>
      <div className="ph">
        <h1>Canned staff messages</h1>
        <div className="pha">
          <Link href="/admin/canned-messages/new" className="btn pri">
            + New message
          </Link>
        </div>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>
        The default replies staff can pick from when warning a player — see /mod/players/[id].
      </p>

      <div className="card">
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Label</th>
                <th>Order</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(messages ?? []).map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/canned-messages/${m.id}`} className="rl">
                      {m.label}
                    </Link>
                  </td>
                  <td>{m.sort_order}</td>
                  <td>
                    <ActiveBadge active={m.is_active} />
                  </td>
                  <td className="act">
                    <Link href={`/admin/canned-messages/${m.id}`} className="btn sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {(messages ?? []).length === 0 ? (
                <tr className="empty">
                  <td colSpan={4}>No canned messages yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
