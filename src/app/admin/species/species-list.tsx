"use client";

import Image from "next/image";
import Link from "next/link";
import { ObtainableBadge } from "@/components/admin/badges";
import { ListFilter } from "@/components/admin/list-filter";

type SpeciesRow = {
  id: string;
  name: string;
  model_number: number | null;
  image_url: string | null;
  breeds: { name: string } | null;
  obtainable: boolean;
};

// Client wrapper so ListFilter's function props (getSearchText,
// getFilterFlag, the render-prop children) stay client-to-client —
// a Server Component can't pass functions as props across the RSC
// boundary, which is what crashed this page with a digest-coded
// server error when the page itself called ListFilter directly.
export function SpeciesList({ rows }: { rows: SpeciesRow[] }) {
  return (
    <ListFilter
      rows={rows}
      getSearchText={(s) => s.name}
      getFilterFlag={(s) => s.obtainable}
      filterLabels={["Obtainable", "Not obtainable"]}
      searchPlaceholder="Search models…"
    >
      {(visibleRows) => (
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Model #</th>
                <th>Breed</th>
                <th>Obtainable</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/species/${s.id}`} className="rl">
                      {s.image_url ? (
                        <span className="th xs">
                          <Image src={s.image_url} alt="" width={26} height={26} />
                        </span>
                      ) : null}
                      {s.name}
                    </Link>
                  </td>
                  <td>{s.breeds?.name ?? "—"}</td>
                  <td>
                    <ObtainableBadge obtainable={s.obtainable} />
                  </td>
                  <td className="act">
                    <Link href={`/admin/species/${s.id}`} className="btn sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr className="empty">
                  <td colSpan={4}>No models match.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </ListFilter>
  );
}
