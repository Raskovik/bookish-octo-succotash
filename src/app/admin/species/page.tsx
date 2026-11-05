import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminSpeciesPage() {
  const { supabase } = await requireAdmin();

  const { data: species } = await supabase
    .from("species")
    .select("id, name, model_number, image_url, is_active, breeds(name)")
    .order("model_number");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Models</h2>
        <Link
          href="/admin/species/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New model
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Model #</th>
              <th className="px-4 py-2">Breed</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(
              (species ?? []) as unknown as {
                id: string;
                name: string;
                model_number: number | null;
                image_url: string | null;
                is_active: boolean;
                breeds: { name: string } | null;
              }[]
            ).map((s) => (
              <tr
                key={s.id}
                className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                <td className="px-4 py-2">
                  <Link href={`/admin/species/${s.id}`} className="flex items-center gap-2 hover:underline">
                    {s.image_url ? (
                      <Image src={s.image_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                    ) : null}
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{s.breeds?.name ?? "—"}</td>
                <td className="px-4 py-2">{s.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(species ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-stone-500">
                  No models yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
