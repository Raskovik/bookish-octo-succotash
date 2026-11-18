import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ZonesList } from "./zones-list";

export default async function AdminZonesPage() {
  const { supabase } = await requireAdmin();

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name, is_tutorial, is_active, reward_coins_base, reward_coins_variance, reward_xp")
    .order("name");

  const rows = zones ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Zones</h2>
        <Link
          href="/admin/zones/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New zone
        </Link>
      </div>

      <ZonesList rows={rows} />
    </div>
  );
}
