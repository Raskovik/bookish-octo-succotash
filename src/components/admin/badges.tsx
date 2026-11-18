// Small colored pill badges reused across every admin list/edit page —
// .badge/.b-* from the furgarden-admin-panel prototype's design system
// (public/css/admin.css).

const BADGE_CLASS: Record<string, string> = {
  green: "b-green",
  gray: "b-gray",
  blue: "b-blue",
  orange: "b-orange",
  red: "b-red",
};

export function Badge({ children, color }: { children: React.ReactNode; color: keyof typeof BADGE_CLASS }) {
  return <span className={`badge ${BADGE_CLASS[color]}`}>{children}</span>;
}

export function ObtainableBadge({ obtainable }: { obtainable: boolean }) {
  return obtainable ? <Badge color="green">Obtainable</Badge> : <Badge color="gray">Not obtainable</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>;
}

export type ShopDisplayStatus = "scheduled" | "live" | "ended";

export function ShopStatusBadge({ status }: { status: ShopDisplayStatus }) {
  if (status === "live") return <Badge color="green">In the shop</Badge>;
  if (status === "scheduled") return <Badge color="blue">Scheduled</Badge>;
  return <Badge color="gray">Ended</Badge>;
}
