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
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <span>Models</span>
      </div>
      <div className="ph">
        <h1>Models</h1>
        <div className="pha">
          <Link href="/admin/species/new" className="btn pri">
            + New model
          </Link>
        </div>
      </div>

      <SpeciesList rows={rows} />
    </>
  );
}
