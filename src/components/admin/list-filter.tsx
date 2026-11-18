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
    <div className="card">
      <div className="tb">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="in"
        />
        {getFilterFlag && filterLabels ? (
          <div className="seg" role="group" aria-label="Show">
            {(["all", "yes", "no"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {value === "all" ? "All" : value === "yes" ? filterLabels[0] : filterLabels[1]}
              </button>
            ))}
          </div>
        ) : null}
        <span className="n">
          {visibleRows.length} of {rows.length} shown
        </span>
      </div>
      {children(visibleRows)}
    </div>
  );
}
