import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminBreedsPage() {
  const { supabase } = await requireAdmin();

  const { data: breeds } = await supabase
    .from("breeds")
    .select("id, name, base_layer_url, rarity_weight, is_active")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Breeds</h2>
        <Link
          href="/admin/breeds/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New breed
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Breed</th>
              <th className="px-4 py-2">Rarity weight</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(breeds ?? []).map((b) => (
              <tr key={b.id} className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900">
                <td className="px-4 py-2">
                  <Link href={`/admin/breeds/${b.id}`} className="flex items-center gap-2 hover:underline">
                    {b.base_layer_url ? (
                      <Image src={b.base_layer_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                    ) : null}
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{b.rarity_weight}</td>
                <td className="px-4 py-2">{b.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(breeds ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-stone-500">
                  No breeds yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
