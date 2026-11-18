import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ActiveBadge } from "@/components/admin/badges";
import { ListFilter } from "@/components/admin/list-filter";

export default async function AdminZonesPage() {
  const { supabase } = await requireAdmin();

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name, is_tutorial, is_active, reward_coins_base, reward_coins_variance, reward_xp")
    .order("name");

  const rows = zones ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Zones</h2>
        <Link
          href="/admin/zones/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New zone
        </Link>
      </div>

      <ListFilter
        rows={rows}
        getSearchText={(zone) => zone.name}
        getFilterFlag={(zone) => zone.is_active}
        filterLabels={["Active", "Inactive"]}
        searchPlaceholder="Search zones…"
      >
        {(visibleRows) => (
          <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
            <table className="w-full text-sm">
              <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
                <tr>
                  <th className="px-4 py-2">Zone</th>
                  <th className="px-4 py-2">Rewards</th>
                  <th className="px-4 py-2">Tutorial</th>
                  <th className="px-4 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((zone) => (
                  <tr
                    key={zone.id}
                    className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
                  >
                    <td className="px-4 py-2">
                      <Link href={`/admin/zones/${zone.id}`} className="hover:underline">
                        {zone.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-stone-600 dark:text-stone-400">
                      {zone.reward_coins_base}–{zone.reward_coins_base + zone.reward_coins_variance} coins, {zone.reward_xp} XP
                    </td>
                    <td className="px-4 py-2">{zone.is_tutorial ? "Yes" : "No"}</td>
                    <td className="px-4 py-2">
                      <ActiveBadge active={zone.is_active} />
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                      No zones match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </ListFilter>
    </div>
  );
}
