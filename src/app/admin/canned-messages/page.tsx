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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Canned staff messages</h2>
          <p className="text-sm text-stone-500">
            The default replies staff can pick from when warning a player — see /mod/players/[id].
          </p>
        </div>
        <Link
          href="/admin/canned-messages/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New message
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(messages ?? []).map((m) => (
              <tr
                key={m.id}
                className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/admin/canned-messages/${m.id}`} className="hover:underline">
                    {m.label}
                  </Link>
                </td>
                <td className="px-4 py-2">{m.sort_order}</td>
                <td className="px-4 py-2">
                  <ActiveBadge active={m.is_active} />
                </td>
              </tr>
            ))}
            {(messages ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-stone-500">
                  No canned messages yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
