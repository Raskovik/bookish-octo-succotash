import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { SpeciesForm } from "../species-form";
import { updateSpecies } from "../actions";
import { getObtainableSources } from "@/lib/admin-obtainable";

export default async function EditSpeciesPage(props: PageProps<"/admin/species/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: species }, { data: breeds }, sources] = await Promise.all([
    supabase
      .from("species")
      .select(
        "id, name, breed_id, model_number, image_url, is_starter_option, starter_label, starter_blurb, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("breeds").select("id, name").order("name"),
    getObtainableSources(supabase, "species", id),
  ]);

  if (!species) {
    notFound();
  }

  const obtainable = sources.some((s) => s.live);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Edit model</h2>
        <SpeciesForm action={updateSpecies} species={species} breeds={breeds ?? []} isNew={false} cancelHref="/admin/species" />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold tracking-tight">
          Where it can be obtained — {obtainable ? "Obtainable" : "Not obtainable"}
        </h3>
        {sources.length === 0 ? (
          <p className="text-sm text-stone-500">Not in any zone&apos;s pool or shop listing.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {sources.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={s.live ? "text-green-700 dark:text-green-400" : "text-stone-500"}>
                  {s.live ? "●" : "○"}
                </span>
                <span>{s.label}</span>
                {s.reason ? <span className="text-xs text-stone-500">({s.reason})</span> : null}
              </li>
            ))}
          </ul>
        )}
        {species.is_starter_option ? (
          <p className="text-sm text-stone-500">
            Also offered as a starter pet on /welcome{species.starter_label ? ` ("${species.starter_label}")` : ""}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
