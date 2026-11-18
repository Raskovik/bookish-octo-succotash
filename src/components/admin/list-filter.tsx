"use client";

import { useMemo, useState } from "react";

export type ListFilterValue = "all" | "yes" | "no";

/**
 * Search box + a 3-way segmented filter (All / yes-label / no-label) for
 * an admin list page's table — client-side only, filters rows already
 * rendered server-side by toggling their visibility, same as every
 * other admin list in this app. `getSearchText`/`getFilterFlag` read
 * whatever each row needs filtered on.
 */
export function ListFilter<T>({
  rows,
  getSearchText,
  getFilterFlag,
  filterLabels,
  searchPlaceholder,
  children,
}: {
  rows: T[];
  getSearchText: (row: T) => string;
  getFilterFlag?: (row: T) => boolean;
  filterLabels?: [string, string];
  searchPlaceholder: string;
  children: (visibleRows: T[]) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ListFilterValue>("all");

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q.length > 0 && !getSearchText(row).toLowerCase().includes(q)) return false;
      if (getFilterFlag && filter !== "all") {
        const flag = getFilterFlag(row);
        if (filter === "yes" && !flag) return false;
        if (filter === "no" && flag) return false;
      }
      return true;
    });
  }, [rows, query, filter, getSearchText, getFilterFlag]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-200 p-3 dark:border-stone-800">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full max-w-xs rounded-md border border-green-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        {getFilterFlag && filterLabels ? (
          <div className="flex overflow-hidden rounded-md border border-green-300 dark:border-stone-700" role="group" aria-label="Show">
            {(["all", "yes", "no"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`border-r px-3 py-1.5 text-xs font-medium last:border-r-0 dark:border-stone-700 ${
                  filter === value
                    ? "bg-green-100 text-green-900 dark:bg-stone-800 dark:text-stone-100"
                    : "bg-white text-stone-600 dark:bg-stone-950 dark:text-stone-400"
                }`}
              >
                {value === "all" ? "All" : value === "yes" ? filterLabels[0] : filterLabels[1]}
              </button>
            ))}
          </div>
        ) : null}
        <span className="ml-auto text-sm text-stone-500">
          {visibleRows.length} of {rows.length} shown
        </span>
      </div>
      {children(visibleRows)}
    </div>
  );
}
