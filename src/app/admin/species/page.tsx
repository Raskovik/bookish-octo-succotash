import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getObtainableIdSet } from "@/lib/admin-obtainable";
import { SpeciesList } from "./species-list";

type SpeciesRow = {
  id: string;
  name: string;
  model_number: number | null;
  image_url: string | null;
  breeds: { name: string } | null;
};

export default async function AdminSpeciesPage() {
  const { supabase } = await requireAdmin();

  const [{ data: species }, obtainableIds] = await Promise.all([
    supabase.from("species").select("id, name, model_number, image_url, breeds(name)").order("model_number"),
    getObtainableIdSet(supabase, "species"),
  ]);

  const rows = ((species ?? []) as unknown as SpeciesRow[]).map((s) => ({
    ...s,
    obtainable: obtainableIds.has(s.id),
  }));

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

      <SpeciesList rows={rows} />
    </div>
  );
}
