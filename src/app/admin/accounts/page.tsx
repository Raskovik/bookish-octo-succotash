import { requireAdmin } from "@/lib/admin";
import { DeleteAccountButton } from "./delete-account-button";

const RESULT_LIMIT = 25;

// Search-by-username + delete, admin-only — the easier-to-find
// counterpart to the same admin_delete_account() tool that also lives
// on a player's /mod/players/[userId] staff page. Mainly for clearing
// out test accounts while exercising onboarding (0070) repeatedly.
export default async function AdminAccountsPage(props: PageProps<"/admin/accounts">) {
  const { supabase } = await requireAdmin();
  const searchParams = await props.searchParams;
  const qRaw = searchParams.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? "";

  // Matches on email too, not just display_name — a test account
  // abandoned mid-onboarding (see 0070) has no username yet at all, so
  // searching by username alone would never find the exact accounts
  // this page exists to clean up. With no search term, just show the
  // most recently created accounts (almost always exactly the test
  // accounts this page gets used for) rather than an empty page.
  let usersQuery = supabase
    .from("users")
    .select("id, display_id, display_name, email, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(RESULT_LIMIT);
  if (q.length > 0) {
    usersQuery = usersQuery.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
  }
  const { data: users } = await usersQuery;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
      <p className="text-sm text-stone-500">Most recently created accounts, or search by username/email.</p>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by username…"
          autoComplete="off"
          className="w-full max-w-sm rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <button
          type="submit"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Admin</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr
                key={u.id}
                className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <td className="px-4 py-2">{u.display_name ?? <i className="text-stone-500">unset — mid-onboarding</i>}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.is_admin ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-right">
                  <DeleteAccountButton targetUserId={u.id} targetName={u.display_name ?? "Unknown player"} />
                </td>
              </tr>
            ))}
            {(users ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                  {q.length > 0 ? <>No accounts match &ldquo;{q}&rdquo;.</> : "No accounts yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
