import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { SpeciesForm } from "../species-form";
import { updateSpecies } from "../actions";
import { getObtainableSources } from "@/lib/admin-obtainable";
import { Badge, ObtainableBadge } from "@/components/admin/badges";

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
        <h1>{species.name}</h1>
      </div>
      <SpeciesForm
        action={updateSpecies}
        species={species}
        breeds={breeds ?? []}
        isNew={false}
        cancelHref="/admin/species"
        obtainableSection={
          <div className="fld" style={{ marginTop: 22 }}>
            <div className="fh" style={{ margin: "0 0 4px", borderTop: "1px solid var(--line2)", paddingTop: 16 }}>
              Where it can be obtained
            </div>
            <p style={{ margin: "0 0 4px" }}>
              Status: <ObtainableBadge obtainable={obtainable} />
            </p>
            <p className="hint">
              {obtainable
                ? "Players can get this model right now from the places below."
                : "Players can't get this model anywhere right now."}
            </p>
            {species.is_starter_option ? (
              <p className="hint">
                Also offered as a starter pet on /welcome
                {species.starter_label ? ` ("${species.starter_label}")` : ""}.
              </p>
            ) : null}
            {sources.length === 0 ? (
              <p className="muted">Not in any zone&apos;s pool or shop listing.</p>
            ) : (
              <div className="tw">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Where</th>
                      <th>Details</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s, i) => (
                      <tr key={i}>
                        <td>{s.where}</td>
                        <td>{s.details}</td>
                        <td>
                          <Badge color={s.live ? "green" : "gray"}>{s.live ? "Live" : "Not live"}</Badge>
                          {!s.live && s.reason ? (
                            <small className="muted" style={{ display: "block" }}>
                              {s.reason}
                            </small>
                          ) : null}
                        </td>
                        <td className="act">
                          <Link href={s.editHref} className="lnk">
                            {s.editLabel} →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
