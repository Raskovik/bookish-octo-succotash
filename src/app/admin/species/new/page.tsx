import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { SpeciesForm } from "../species-form";
import { createSpecies } from "../actions";

export default async function NewSpeciesPage() {
  const { supabase } = await requireAdmin();

  const { data: breeds } = await supabase.from("breeds").select("id, name").order("name");

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Admin</Link>
        <i>/</i>
        <Link href="/admin/species">Models</Link>
        <i>/</i>
        <span>New</span>
      </div>
      <div className="ph">
        <h1>New model</h1>
      </div>
      <SpeciesForm action={createSpecies} breeds={breeds ?? []} isNew cancelHref="/admin/species" />
    </>
  );
}
