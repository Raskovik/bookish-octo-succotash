import Link from "next/link";
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
    <>
      <div className="crumbs">
        <Link href="/admin">Dashboard</Link>
        <i>/</i>
        <Link href="/admin/species">Models</Link>
        <i>/</i>
        <span>{species.name}</span>
      </div>
      <div className="ph">
        <h1>Edit model</h1>
      </div>
      <SpeciesForm action={updateSpecies} species={species} breeds={breeds ?? []} isNew={false} cancelHref="/admin/species" />

      <section className="sub card pad">
        <h2>Where it can be obtained — {obtainable ? "Obtainable" : "Not obtainable"}</h2>
        {sources.length === 0 ? (
          <p className="muted">Not in any zone&apos;s pool or shop listing.</p>
        ) : (
          <ul className="act-list">
            {sources.map((s, i) => (
              <li key={i}>
                <span className={s.live ? "" : "muted"} style={s.live ? { color: "var(--greend)" } : undefined}>
                  {s.live ? "●" : "○"}
                </span>{" "}
                <span>{s.label}</span>
                {s.reason ? <small>({s.reason})</small> : null}
              </li>
            ))}
          </ul>
        )}
        {species.is_starter_option ? (
          <p className="muted">
            Also offered as a starter pet on /welcome{species.starter_label ? ` ("${species.starter_label}")` : ""}.
          </p>
        ) : null}
      </section>
    </>
  );
}
