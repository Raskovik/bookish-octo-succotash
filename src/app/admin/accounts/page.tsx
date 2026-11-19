import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { DeleteAccountButton } from "./delete-account-button";

// Search-by-username + delete, admin-only — the easier-to-find
// counterpart to the same admin_delete_account() tool that also lives
// on a player's /mod/players/[userId] staff page. Mainly for clearing
// out test accounts while exercising onboarding (0070) repeatedly.
export default async function AdminAccountsPage(props: PageProps<"/admin/accounts">) {
  const { supabase, user } = await requireAdmin();
  const searchParams = await props.searchParams;
  const qRaw = searchParams.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? "";

  // users' own RLS only ever allows auth.uid() = id — querying the
  // table directly through the normal client, even as an admin, only
  // ever returns the signed-in admin's own row. admin_list_accounts()
  // (0074) is a security-definer RPC built exactly for this page:
  // admin-gated, and matches on email too (not just display_name — a
  // test account abandoned mid-onboarding, see 0070, has no username
  // yet at all, so searching by username alone would never find it).
  const { data: users } = await supabase.rpc("admin_list_accounts", {
    p_admin_user_id: user.id,
    p_query: q.length > 0 ? q : null,
  });

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <span>Accounts</span>
      </div>
      <div className="ph">
        <h1>Accounts</h1>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>Most recently created accounts, or search by username/email.</p>

      <div className="card">
        <form className="tb">
          <input type="text" name="q" defaultValue={q} placeholder="Search by username…" autoComplete="off" className="in" />
          <button type="submit" className="btn pri">
            Search
          </button>
        </form>
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Admin</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id}>
                  <td>{u.display_name ?? <i className="muted">unset — mid-onboarding</i>}</td>
                  <td>{u.email}</td>
                  <td>{u.is_admin ? "Yes" : "No"}</td>
                  <td className="act">
                    <DeleteAccountButton targetUserId={u.id} targetName={u.display_name ?? "Unknown player"} />
                  </td>
                </tr>
              ))}
              {(users ?? []).length === 0 ? (
                <tr className="empty">
                  <td colSpan={4}>{q.length > 0 ? <>No accounts match &ldquo;{q}&rdquo;.</> : "No accounts yet."}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
