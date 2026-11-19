"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge, ObtainableBadge } from "@/components/admin/badges";
import { ListFilter } from "@/components/admin/list-filter";

type ItemRow = {
  id: string;
  name: string;
  type: string;
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
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Sell value</th>
                <th>Obtainable</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/admin/items/${item.id}`} className="rl">
                      {item.image_url ? (
                        <span className="th xs">
                          <Image src={item.image_url} alt="" width={26} height={26} />
                        </span>
                      ) : null}
                      {item.name}
                    </Link>
                  </td>
                  <td>
                    <Badge color="gray">{item.type}</Badge>
                  </td>
                  <td>{item.sell_value}</td>
                  <td>
                    <ObtainableBadge obtainable={item.obtainable} />
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr className="empty">
                  <td colSpan={4}>No items match.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </ListFilter>
  );
}
