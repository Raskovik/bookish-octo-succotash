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
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Rewards</th>
                <th>Tutorial</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((zone) => (
                <tr key={zone.id}>
                  <td>
                    <Link href={`/admin/zones/${zone.id}`} className="rl">
                      {zone.name}
                    </Link>
                  </td>
                  <td className="muted">
                    {zone.reward_coins_base}–{zone.reward_coins_base + zone.reward_coins_variance} coins, {zone.reward_xp} XP
                  </td>
                  <td>{zone.is_tutorial ? "Yes" : "No"}</td>
                  <td>
                    <ActiveBadge active={zone.is_active} />
                  </td>
                  <td className="act">
                    <Link href={`/admin/zones/${zone.id}`} className="btn sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr className="empty">
                  <td colSpan={5}>No zones match.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </ListFilter>
  );
}
