// Shared by the server-rendered browse page and its client panes — see
// time-left.ts for why this is a plain importable function rather than
// a closure passed down as a prop.
export function buildPageHref(
  tab: "items" | "pets",
  filters: { q: string; cat?: string; cur: string; min: number | ""; max: number | ""; sort: string },
  page: number,
): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (filters.q) params.set("q", filters.q);
  if (filters.cat) params.set("cat", filters.cat);
  if (filters.cur) params.set("cur", filters.cur);
  if (filters.min !== "") params.set("min", String(filters.min));
  if (filters.max !== "") params.set("max", String(filters.max));
  if (filters.sort && filters.sort !== "new") params.set("sort", filters.sort);
  params.set("page", String(page));
  return `?${params.toString()}`;
}
