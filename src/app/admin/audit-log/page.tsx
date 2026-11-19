import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

type AuditLogEntryRow = {
  id: string;
  admin_user_id: string | null;
  action_type: string;
  target_table: string;
  target_id: string;
  change_summary: unknown;
  created_at: string;
  users: { display_name: string; email: string } | null;
};

const PAGE_SIZE = 50;

export default async function AdminAuditLogPage() {
  const { supabase } = await requireAdmin();

  // The embedded users(...) row only resolves for admin_user_id = the
  // querying admin's own id — RLS on users only permits auth.uid() = id.
  // Fine today since this app has exactly one admin; would need a wider
  // users-select policy (or a view) if a second admin is ever added.
  const { data } = await supabase
    .from("admin_audit_log")
    .select("id, admin_user_id, action_type, target_table, target_id, change_summary, created_at, users(display_name, email)")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const entries = (data ?? []) as unknown as AuditLogEntryRow[];

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <span>Audit log</span>
      </div>
      <div className="ph">
        <h1>Audit log</h1>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>
        Every admin-panel write to zones, items, species, and potion recipes, most recent first. Read-only — the{" "}
        {PAGE_SIZE} most recent entries.
      </p>

      <div className="card">
        {entries.map((entry) => (
          <details key={entry.id} className="ad">
            <summary>
              <span className="muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".6px" }}>
                {entry.action_type}
              </span>
              <span style={{ fontWeight: 800 }}>{entry.target_table}</span>
              <span className="muted">by {entry.users?.display_name ?? entry.admin_user_id ?? "unknown"}</span>
              <span className="when">{new Date(entry.created_at).toLocaleString()}</span>
            </summary>
            <div className="body">
              <pre>{JSON.stringify(entry.change_summary, null, 2)}</pre>
            </div>
          </details>
        ))}
        {entries.length === 0 ? <p className="muted" style={{ padding: "24px 16px", textAlign: "center" }}>No admin actions logged yet.</p> : null}
      </div>
    </>
  );
}
