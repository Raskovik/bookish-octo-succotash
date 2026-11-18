"use client";

import Image from "next/image";
import Link from "next/link";
import { ObtainableBadge } from "@/components/admin/badges";
import { ListFilter } from "@/components/admin/list-filter";

type ItemRow = {
  id: string;
  name: string;
  type: string;
  rarity: string;
  image_url: string | null;
  sell_value: number;
  obtainable: boolean;
};

// Client wrapper so ListFilter's function props (getSearchText,
// getFilterFlag, the render-prop children) stay client-to-client —
// a Server Component can't pass functions as props across the RSC
// boundary, which is what crashed this page with a digest-coded
// server error when the page itself called ListFilter directly.
export function ItemsList({ rows }: { rows: ItemRow[] }) {
  return (
    <ListFilter
      rows={rows}
      getSearchText={(item) => item.name}
      getFilterFlag={(item) => item.obtainable}
      filterLabels={["Obtainable", "Not obtainable"]}
      searchPlaceholder="Search items…"
    >
      {(visibleRows) => (
        <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
          <table className="w-full text-sm">
            <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Rarity</th>
                <th className="px-4 py-2">Sell value</th>
                <th className="px-4 py-2">Obtainable</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
                >
                  <td className="px-4 py-2">
                    <Link href={`/admin/items/${item.id}`} className="flex items-center gap-2 hover:underline">
                      {item.image_url ? (
                        <Image src={item.image_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                      ) : null}
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{item.type}</td>
                  <td className="px-4 py-2 capitalize">{item.rarity}</td>
                  <td className="px-4 py-2">{item.sell_value}</td>
                  <td className="px-4 py-2">
                    <ObtainableBadge obtainable={item.obtainable} />
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-stone-500">
                    No items match.
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
