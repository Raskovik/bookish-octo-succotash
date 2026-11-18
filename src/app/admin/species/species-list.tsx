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
        <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
          <table className="w-full text-sm">
            <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
              <tr>
                <th className="px-4 py-2">Model #</th>
                <th className="px-4 py-2">Breed</th>
                <th className="px-4 py-2">Obtainable</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
                >
                  <td className="px-4 py-2">
                    <Link href={`/admin/species/${s.id}`} className="flex items-center gap-2 hover:underline">
                      {s.image_url ? (
                        <Image src={s.image_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                      ) : null}
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{s.breeds?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <ObtainableBadge obtainable={s.obtainable} />
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-stone-500">
                    No models match.
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
