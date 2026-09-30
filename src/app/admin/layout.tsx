import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin panel</h1>
        <nav className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href="/admin" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/admin/zones" className="hover:underline">
            Zones
          </Link>
          <Link href="/admin/items" className="hover:underline">
            Items
          </Link>
          <Link href="/admin/species" className="hover:underline">
            Species
          </Link>
          <Link href="/admin/recipes" className="hover:underline">
            Potion recipes
          </Link>
          <Link href="/admin/forums" className="hover:underline">
            Forums
          </Link>
          <Link href="/admin/canned-messages" className="hover:underline">
            Canned messages
          </Link>
          <Link href="/admin/currency" className="hover:underline">
            Currency
          </Link>
          <Link href="/admin/audit-log" className="hover:underline">
            Audit log
          </Link>
        </nav>
      </div>
      {children}
    </main>
  );
}
