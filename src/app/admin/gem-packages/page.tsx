import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminGemPackagesPage() {
  const { supabase } = await requireAdmin();

  const { data: packages } = await supabase
    .from("gem_packages")
    .select("id, name, gem_amount, price_cents, is_active, sort_order")
    .order("sort_order");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Gem packages</h2>
          <p className="text-sm text-stone-500">What players can buy with real money on /gems.</p>
        </div>
        <Link
          href="/admin/gem-packages/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New package
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Gems</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(packages ?? []).map((pkg) => (
              <tr
                key={pkg.id}
                className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/admin/gem-packages/${pkg.id}`} className="hover:underline">
                    {pkg.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{pkg.gem_amount}</td>
                <td className="px-4 py-2">${(pkg.price_cents / 100).toFixed(2)}</td>
                <td className="px-4 py-2">{pkg.sort_order}</td>
                <td className="px-4 py-2">{pkg.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(packages ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone-500">
                  No gem packages yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
