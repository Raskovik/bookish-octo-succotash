"use client";

import Link from "next/link";
import { ActiveBadge } from "@/components/admin/badges";
import { ListFilter } from "@/components/admin/list-filter";

type ZoneRow = {
  id: string;
  name: string;
  is_tutorial: boolean;
  is_active: boolean;
  reward_coins_base: number;
  reward_coins_variance: number;
  reward_xp: number;
};

// Client wrapper so ListFilter's function props (getSearchText,
// getFilterFlag, the render-prop children) stay client-to-client —
// a Server Component can't pass functions as props across the RSC
// boundary, which is what crashed this page with a digest-coded
// server error when the page itself called ListFilter directly.
export function ZonesList({ rows }: { rows: ZoneRow[] }) {
  return (
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
  );
}
