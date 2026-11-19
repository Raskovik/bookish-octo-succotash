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
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <span>Zones</span>
      </div>
      <div className="ph">
        <h1>Zones</h1>
        <div className="pha">
          <Link href="/admin/zones/new" className="btn pri">
            + New zone
          </Link>
        </div>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>
        Places pets can go exploring. Each zone has its own pet pool and item pool, with the odds for each.
      </p>

      <ZonesList rows={rows} />
    </>
  );
}
