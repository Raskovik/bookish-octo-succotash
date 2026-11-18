// Small colored pill badges reused across every admin list/edit page —
// see the furgarden-admin-panel redesign package's "Reused components
// worth building once: Obtainable/Status tags".

const COLOR_CLASS: Record<string, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  gray: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function Badge({ children, color }: { children: React.ReactNode; color: keyof typeof COLOR_CLASS }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR_CLASS[color]}`}>
      {children}
    </span>
  );
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
