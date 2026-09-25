import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

// Hand-cast, like every other joined select in this project (see the
// comment on PetWithSpecies in lib/supabase/types.ts) — table types here
// always set Relationships: [], so the Supabase client can't infer this
// embed's shape on its own.
type EyeTypeListRow = {
  id: string;
  name: string;
  layer_url: string | null;
  rarity_tier: string;
  is_active: boolean;
  breeds: { name: string } | null;
};

export default async function AdminEyeTypesPage() {
  const { supabase } = await requireAdmin();

  const { data: eyeTypesData } = await supabase
    .from("eye_types")
    .select("id, name, layer_url, rarity_tier, is_active, breeds(name)")
    .order("name");
  const eyeTypes = (eyeTypesData ?? []) as unknown as EyeTypeListRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Eye types</h2>
        <Link
          href="/admin/eye-types/new"
          className="rounded-md bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-200 dark:text-green-950 dark:hover:bg-green-300"
        >
          + New eye type
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-green-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-green-100 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-2">Eye type</th>
              <th className="px-4 py-2">Breed</th>
              <th className="px-4 py-2">Rarity</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(eyeTypes ?? []).map((e) => (
              <tr key={e.id} className="border-t border-green-200 hover:bg-green-50 dark:border-stone-800 dark:hover:bg-stone-900">
                <td className="px-4 py-2">
                  <Link href={`/admin/eye-types/${e.id}`} className="flex items-center gap-2 hover:underline">
                    {e.layer_url ? (
                      <Image src={e.layer_url} alt="" width={24} height={24} className="h-6 w-6 rounded" />
                    ) : null}
                    {e.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{e.breeds?.name ?? "—"}</td>
                <td className="px-4 py-2 capitalize">{e.rarity_tier}</td>
                <td className="px-4 py-2">{e.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(eyeTypes ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                  No eye types yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
