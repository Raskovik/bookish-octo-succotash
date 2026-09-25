import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminColorsPage() {
  const { supabase } = await requireAdmin();

  const { data: colors } = await supabase
    .from("colors")
    .select("id, name, hex_swatch, rarity_tier, is_active")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Colors</h2>
        <Link
          href="/admin/colors/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New color
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Color</th>
              <th className="px-4 py-2">Rarity</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(colors ?? []).map((c) => (
              <tr key={c.id} className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900">
                <td className="px-4 py-2">
                  <Link href={`/admin/colors/${c.id}`} className="flex items-center gap-2 hover:underline">
                    <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: c.hex_swatch }} />
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2 capitalize">{c.rarity_tier}</td>
                <td className="px-4 py-2">{c.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(colors ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-stone-500">
                  No colors yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
