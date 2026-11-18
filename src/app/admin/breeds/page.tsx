import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { addBreed, renameBreed } from "./actions";

export default async function AdminBreedsPage() {
  const { supabase } = await requireAdmin();

  const { data: breeds } = await supabase.from("breeds").select("id, name").order("name");

  return (
    <>
      <div className="crumbs">
        <Link href="/admin">Admin</Link>
        <i>/</i>
        <span>Breeds</span>
      </div>
      <div className="ph">
        <h1>Breeds</h1>
      </div>
      <p className="desc" style={{ marginBottom: 14 }}>
        The lineart/animal group a model belongs to (Cat, Dog, …) — pick one per model on the{" "}
        <Link href="/admin/species">Models</Link> page.
      </p>

      <div className="card">
        <form action={addBreed} className="tb">
          <input name="name" required placeholder="New breed name" className="in" />
          <button type="submit" className="btn pri">
            Add breed
          </button>
        </form>
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(breeds ?? []).map((breed) => (
                <tr key={breed.id}>
                  <td>
                    <form action={renameBreed} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="hidden" name="breed_id" value={breed.id} />
                      <input name="name" defaultValue={breed.name} required className="in sm" />
                      <button type="submit" className="btn sm">
                        Rename
                      </button>
                    </form>
                  </td>
                  <td />
                </tr>
              ))}
              {(breeds ?? []).length === 0 ? (
                <tr className="empty">
                  <td colSpan={2}>No breeds yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
