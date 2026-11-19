import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ZoneForm } from "../zone-form";
import { createZone } from "../actions";

export default async function NewZonePage() {
  await requireAdmin();

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/zones">Zones</Link>
        <i>/</i>
        <span>New</span>
      </div>
      <div className="ph">
        <h1>New zone</h1>
      </div>
      <p className="hint" style={{ maxWidth: 760 }}>
        You&apos;ll be able to add pets and items to this zone&apos;s pool after creating it.
      </p>
      <ZoneForm action={createZone} isNew cancelHref="/admin/zones" />
    </>
  );
}
